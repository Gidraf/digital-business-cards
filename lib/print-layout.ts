/**
 * Imposition engine: lays card instances out N-up on printer paper and
 * produces a self-contained HTML document (mm-accurate, @page sized) that
 * is used for the on-screen preview, `window.print()` and the server PDF.
 *
 * Cards of different physical sizes can share a job; each run of same-size
 * cards gets its own grid and starts on a fresh page.
 */
import QRCode from "qrcode";
import type { CardData, PaperName, PrintItem, PrintLayoutSettings, PrintMaterials, TemplateConfig, CardTemplate } from "./types";
import { getGoogleFontsUrl, getUsedFonts } from "./fonts";
import { designCardData, personCardData, qrPayloadFor } from "./card-data";
import { renderFaceHtml, type RenderImages } from "./render-html";
import { estimateCoverage, inkSaveConfig, type InkMode } from "./ink";

export const MM_PX = 96 / 25.4; // CSS px per mm

export const PAPERS: Record<Exclude<PaperName, "custom">, { width_mm: number; height_mm: number }> = {
    A4: { width_mm: 210, height_mm: 297 },
    A3: { width_mm: 297, height_mm: 420 },
    A5: { width_mm: 148, height_mm: 210 },
    Letter: { width_mm: 215.9, height_mm: 279.4 },
    Legal: { width_mm: 215.9, height_mm: 355.6 },
};

export const DEFAULT_LAYOUT: PrintLayoutSettings = {
    ink: "saver",
    grayscale: false,
    margin_mm: 5,
    gap_mm: 3,
    crop_marks: true,
    duplex: true,
    back_mode: "duplex",
    scale: 1,
    auto_fit: true,
};

export function paperSize(paper: PaperName, orientation: "portrait" | "landscape", custom?: { width_mm: number; height_mm: number }) {
    const base = paper === "custom" ? (custom ?? PAPERS.A4) : PAPERS[paper];
    const w = orientation === "landscape" ? Math.max(base.width_mm, base.height_mm) : Math.min(base.width_mm, base.height_mm);
    const h = orientation === "landscape" ? Math.min(base.width_mm, base.height_mm) : Math.max(base.width_mm, base.height_mm);
    return { width_mm: w, height_mm: h };
}

export interface Grid {
    cols: number;
    rows: number;
    perPage: number;
    offsetX: number; // mm, left edge of first column (grid centred on page)
    offsetY: number;
    cardW: number;   // mm
    cardH: number;
}

export function computeGrid(page: { width_mm: number; height_mm: number }, cardW: number, cardH: number, layout: PrintLayoutSettings): Grid {
    const margin = Math.max(0, layout.margin_mm);
    const gap = Math.max(0, layout.gap_mm);
    const availW = page.width_mm - margin * 2;
    const availH = page.height_mm - margin * 2;
    let cols = Math.max(0, Math.floor((availW + gap) / (cardW + gap)));
    let rows = Math.max(0, Math.floor((availH + gap) / (cardH + gap)));
    if (!layout.auto_fit) {
        if (layout.cols) cols = Math.min(cols, Math.max(1, layout.cols));
        if (layout.rows) rows = Math.min(rows, Math.max(1, layout.rows));
    }
    const usedW = cols * cardW + Math.max(0, cols - 1) * gap;
    const usedH = rows * cardH + Math.max(0, rows - 1) * gap;
    return {
        cols, rows, perPage: cols * rows,
        offsetX: (page.width_mm - usedW) / 2,
        offsetY: (page.height_mm - usedH) / 2,
        cardW, cardH,
    };
}

/** One physical card to print (an item expanded by its quantity). */
export interface CardInstance {
    key: string;              // "<item index>-<copy>"
    label: string;
    kind: string;
    front: TemplateConfig;
    back: TemplateConfig | null;
    data: CardData;
    images: RenderImages;
    width_mm: number;
    height_mm: number;
    include_back: boolean;
}

export interface ExpandOptions {
    /** resolved image sources (data URIs) keyed by original URL */
    imageCache?: Map<string, string>;
    /** generate QR codes for templates that use them */
    withQr?: boolean;
}

export function templateFor(item: PrintItem, materials: PrintMaterials): CardTemplate | null {
    const byId = (id: string | null | undefined) => (id ? materials.templates.find((t) => t.id === id) ?? null : null);
    if (item.template_id) return byId(item.template_id);
    if (item.source === "person") return byId(materials.people.find((p) => p.id === item.source_id)?.template_id);
    return byId(materials.designs.find((d) => d.id === item.source_id)?.template_id);
}

export function itemLabel(item: PrintItem, materials: PrintMaterials): string {
    if (item.source === "person") {
        const p = materials.people.find((x) => x.id === item.source_id);
        return p ? `${p.first_name} ${p.last_name}`.trim() : "Person";
    }
    const d = materials.designs.find((x) => x.id === item.source_id);
    return d?.name ?? "Design";
}

export function itemData(item: PrintItem, materials: PrintMaterials): CardData | null {
    if (item.source === "person") {
        const p = materials.people.find((x) => x.id === item.source_id);
        if (!p) return null;
        return personCardData(p, materials.companies.find((c) => c.id === p.company_id));
    }
    const d = materials.designs.find((x) => x.id === item.source_id);
    return d ? designCardData(d) : null;
}

function usesQr(cfg: TemplateConfig | null): boolean {
    return !!cfg && cfg.elements.some((e) => e.type === "qrcode");
}

function assetIds(cfg: TemplateConfig | null): string[] {
    if (!cfg) return [];
    return cfg.elements
        .map((e) => e.imageSource ?? "")
        .filter((s) => s.startsWith("asset:") && !s.startsWith("asset:data:"))
        .map((s) => s.slice(6));
}

/**
 * Expand job items into card instances with resolved (inlined) images.
 * `resolveImage` turns a URL into a data URI (see inlineImageUrl); when it
 * returns null the URL is used as-is.
 */
export async function expandItems(
    items: PrintItem[],
    materials: PrintMaterials,
    resolveImage: (url: string) => Promise<string | null>,
    withQr = true,
): Promise<{ cards: CardInstance[]; skipped: string[] }> {
    const cards: CardInstance[] = [];
    const skipped: string[] = [];
    const urlCache = new Map<string, string>();
    const inline = async (url: string | null | undefined) => {
        if (!url) return null;
        if (urlCache.has(url)) return urlCache.get(url)!;
        const v = (await resolveImage(url)) ?? url;
        urlCache.set(url, v);
        return v;
    };

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const template = templateFor(item, materials);
        const data = itemData(item, materials);
        const label = itemLabel(item, materials);
        if (!template || !data) {
            skipped.push(label);
            continue;
        }
        const logo = await inline(data.logoUrl);
        const photo = await inline(data.photoUrl);
        const assets: Record<string, string | null> = {};
        for (const id of [...assetIds(template.config), ...assetIds(template.back_config)]) {
            if (!(id in assets)) assets[id] = await inline(materials.asset_urls[id]);
        }
        let qr: string | null = null;
        if (withQr && (usesQr(template.config) || usesQr(template.back_config))) {
            const payload = qrPayloadFor(data, template.kind);
            if (payload) {
                try {
                    qr = await QRCode.toDataURL(payload, { width: 512, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
                } catch { qr = null; }
            }
        }
        const images: RenderImages = { logo, photo, assets, qr };
        for (let c = 0; c < item.quantity; c++) {
            cards.push({
                key: `${i}-${c}`,
                label,
                kind: template.kind,
                front: template.config,
                back: template.back_config,
                data,
                images,
                width_mm: template.width_mm,
                height_mm: template.height_mm,
                include_back: item.include_back && !!template.back_config,
            });
        }
    }
    return { cards, skipped };
}

/** Fetch an image and return it as a data URI (browser). Falls back to the
 * Next.js proxy when the direct fetch is blocked by CORS. */
export async function inlineImageUrl(url: string): Promise<string | null> {
    if (url.startsWith("data:")) return url;
    const toDataUri = async (res: Response) => {
        const blob = await res.blob();
        return new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = reject;
            r.readAsDataURL(blob);
        });
    };
    try {
        const res = await fetch(url, { mode: "cors" });
        if (res.ok) return await toDataUri(res);
    } catch { /* fall through to proxy */ }
    try {
        const res = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
        if (res.ok) return await toDataUri(res);
    } catch { /* ignore */ }
    return null;
}

// ── sheet HTML ───────────────────────────────────────────────────────────────

export interface SheetPage {
    side: "front" | "back";
    grid: Grid;
    slots: (CardInstance | null)[]; // length = grid.perPage; null = empty slot
    sizeKey: string;
}

/** Group consecutive same-size cards, paginate each group, add back pages. */
export function paginate(cards: CardInstance[], page: { width_mm: number; height_mm: number }, layout: PrintLayoutSettings): SheetPage[] {
    const pages: SheetPage[] = [];
    const scale = layout.scale > 0 ? layout.scale : 1;
    const frontPages: SheetPage[] = [];
    const backPages: SheetPage[] = [];
    const anyBack = layout.back_mode !== "none" && cards.some((c) => c.include_back);

    let i = 0;
    while (i < cards.length) {
        const w = (layout.card_width_mm ?? cards[i].width_mm) * scale;
        const h = (layout.card_height_mm ?? cards[i].height_mm) * scale;
        const sizeKey = `${w.toFixed(2)}x${h.toFixed(2)}`;
        const grid = computeGrid(page, w, h, layout);
        if (grid.perPage === 0) {
            // card larger than the printable area — one per page, clipped
            const g: Grid = { ...grid, cols: 1, rows: 1, perPage: 1, offsetX: Math.max(0, (page.width_mm - w) / 2), offsetY: Math.max(0, (page.height_mm - h) / 2) };
            frontPages.push({ side: "front", grid: g, slots: [cards[i]], sizeKey });
            if (anyBack) backPages.push({ side: "back", grid: g, slots: [cards[i].include_back ? cards[i] : null], sizeKey });
            i++;
            continue;
        }
        // take all consecutive cards with this size
        let j = i;
        while (j < cards.length && `${((layout.card_width_mm ?? cards[j].width_mm) * scale).toFixed(2)}x${((layout.card_height_mm ?? cards[j].height_mm) * scale).toFixed(2)}` === sizeKey) j++;
        const run = cards.slice(i, j);
        for (let k = 0; k < run.length; k += grid.perPage) {
            const slots: (CardInstance | null)[] = run.slice(k, k + grid.perPage);
            while (slots.length < grid.perPage) slots.push(null);
            frontPages.push({ side: "front", grid, slots, sizeKey });
            if (anyBack) {
                // mirror columns so a long-edge duplex flip lines backs up with fronts
                const mirrored: (CardInstance | null)[] = new Array(grid.perPage).fill(null);
                slots.forEach((card, idx) => {
                    const row = Math.floor(idx / grid.cols);
                    const col = idx % grid.cols;
                    const mcol = grid.cols - 1 - col;
                    mirrored[row * grid.cols + mcol] = card && card.include_back ? card : null;
                });
                backPages.push({ side: "back", grid, slots: mirrored, sizeKey });
            }
        }
        i = j;
    }

    if (!anyBack) return frontPages;
    if (layout.back_mode === "separate") return [...frontPages, ...backPages];
    // duplex: interleave front/back
    frontPages.forEach((fp, idx) => { pages.push(fp); pages.push(backPages[idx]); });
    return pages;
}

function cropMarks(x: number, y: number, w: number, h: number): string {
    const len = 3, off = 1, stroke = 0.2;
    const line = (x1: number, y1: number, x2: number, y2: number) =>
        `<div style="position:absolute;left:${Math.min(x1, x2)}mm;top:${Math.min(y1, y2)}mm;width:${Math.max(Math.abs(x2 - x1), stroke)}mm;height:${Math.max(Math.abs(y2 - y1), stroke)}mm;background:#000;"></div>`;
    return [
        line(x - off - len, y, x - off, y), line(x, y - off - len, x, y - off),
        line(x + w + off, y, x + w + off + len, y), line(x + w, y - off - len, x + w, y - off),
        line(x - off - len, y + h, x - off, y + h), line(x, y + h + off, x, y + h + off + len),
        line(x + w + off, y + h, x + w + off + len, y + h), line(x + w, y + h + off, x + w, y + h + off + len),
    ].join("");
}

export interface SheetOptions {
    paper: PaperName;
    orientation: "portrait" | "landscape";
    layout: PrintLayoutSettings;
    customPaper?: { width_mm: number; height_mm: number };
    title?: string;
    /** draw a light outline around each card (screen preview only) */
    previewOutlines?: boolean;
    /** lighten heavy fills before printing (see lib/ink.ts) */
    ink?: InkMode;
    /** print with black ink only */
    grayscale?: boolean;
}

/** Apply the ink-saving transform to every face of every card. */
export function inkSaveCards(cards: CardInstance[], mode: InkMode): CardInstance[] {
    if (mode === "off") return cards;
    const cache = new Map<TemplateConfig, TemplateConfig>();
    const conv = (cfg: TemplateConfig) => {
        let out = cache.get(cfg);
        if (!out) { out = inkSaveConfig(cfg, mode); cache.set(cfg, out); }
        return out;
    };
    return cards.map((c) => ({ ...c, front: conv(c.front), back: c.back ? conv(c.back) : null }));
}

/** Estimated ink coverage per sheet, 0–1 (see lib/ink.ts). */
export function sheetCoverage(cards: CardInstance[], page: { width_mm: number; height_mm: number }, layout: PrintLayoutSettings): number {
    if (cards.length === 0) return 0;
    const pageArea = page.width_mm * page.height_mm;
    const scale = layout.scale > 0 ? layout.scale : 1;
    const pages = paginate(cards, page, layout);
    if (pages.length === 0) return 0;
    let ink = 0;
    for (const p of pages) {
        for (const card of p.slots) {
            if (!card) continue;
            const w = (layout.card_width_mm ?? card.width_mm) * scale;
            const h = (layout.card_height_mm ?? card.height_mm) * scale;
            const face = p.side === "back" ? (card.back ?? card.front) : card.front;
            ink += ((w * h) / pageArea) * estimateCoverage(face);
        }
    }
    return ink / pages.length;
}

export function buildSheetHtml(rawCards: CardInstance[], opts: SheetOptions): { html: string; pages: SheetPage[]; page: { width_mm: number; height_mm: number } } {
    const cards = inkSaveCards(rawCards, opts.ink ?? "off");
    const page = paperSize(opts.paper, opts.orientation, opts.customPaper);
    const pages = paginate(cards, page, opts.layout);
    const fonts = new Set<string>();
    for (const c of cards) {
        for (const f of getUsedFonts(c.front.elements)) fonts.add(f);
        if (c.back) for (const f of getUsedFonts(c.back.elements)) fonts.add(f);
    }
    const fontsUrl = getGoogleFontsUrl([...fonts]);

    const pageHtml = pages.map((p, pi) => {
        const { grid } = p;
        const slots = p.slots.map((card, idx) => {
            const row = Math.floor(idx / grid.cols);
            const col = idx % grid.cols;
            const x = grid.offsetX + col * (grid.cardW + opts.layout.gap_mm);
            const y = grid.offsetY + row * (grid.cardH + opts.layout.gap_mm);
            const marks = opts.layout.crop_marks && card ? cropMarks(x, y, grid.cardW, grid.cardH) : "";
            if (!card) return marks;
            const cfg = p.side === "front" ? card.front : (card.back ?? card.front);
            const s = (grid.cardW * MM_PX) / cfg.width;
            const face = renderFaceHtml(cfg, card.data, card.images, { interactive: false, textMode: "wrap" }, `transform:scale(${s});transform-origin:top left;`);
            const outline = opts.previewOutlines ? "outline:0.2mm dashed rgba(0,0,0,0.25);outline-offset:-0.1mm;" : "";
            return `${marks}<div class="slot" data-card="${card.key}" style="position:absolute;left:${x}mm;top:${y}mm;width:${grid.cardW}mm;height:${grid.cardH}mm;overflow:hidden;${outline}">${face}</div>`;
        }).join("\n");
        return `<section class="sheet ${p.side}" data-page="${pi + 1}" style="width:${page.width_mm}mm;height:${page.height_mm}mm;">${slots}</section>`;
    }).join("\n");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${(opts.title ?? "Print sheet").replace(/</g, "&lt;")}</title>
${fontsUrl ? `<link rel="stylesheet" href="${fontsUrl}">` : ""}
<style>
@page { size: ${page.width_mm}mm ${page.height_mm}mm; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
.sheet { position: relative; overflow: hidden; background: #fff; page-break-after: always; break-after: page; }
.sheet:last-child { page-break-after: auto; break-after: auto; }
.card-face { -webkit-print-color-adjust: exact; print-color-adjust: exact; ${opts.grayscale ? "filter: grayscale(1);" : ""} }
.card-face img { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@media screen { body { background: #e5e7eb; padding: 12px; } .sheet { margin: 0 auto 12px auto; box-shadow: 0 2px 12px rgba(0,0,0,0.15); } }
@media print { body { background: #fff; padding: 0; } .sheet { margin: 0; box-shadow: none; } }
</style>
</head>
<body>
${pageHtml}
</body>
</html>`;
    return { html, pages, page };
}

/** Summary numbers for the studio UI. */
export function layoutSummary(cards: CardInstance[], opts: SheetOptions) {
    const page = paperSize(opts.paper, opts.orientation, opts.customPaper);
    const pages = paginate(cards, page, opts.layout);
    const fronts = pages.filter((p) => p.side === "front").length;
    const backs = pages.length - fronts;
    const first = cards[0];
    const grid = first ? computeGrid(page, (opts.layout.card_width_mm ?? first.width_mm) * (opts.layout.scale || 1), (opts.layout.card_height_mm ?? first.height_mm) * (opts.layout.scale || 1), opts.layout) : null;
    return { pages: pages.length, fronts, backs, perPage: grid?.perPage ?? 0, cols: grid?.cols ?? 0, rows: grid?.rows ?? 0, cards: cards.length };
}

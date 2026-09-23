/**
 * Smart logo / artwork builder.
 *
 * Most walk-in customers have no logo file. Instead of leaving the slot empty
 * (or buying an AI raster image that costs money and floods the card with ink),
 * we build one from their name: pure SVG, so it prints razor-sharp at any size
 * and — in "line" style — uses almost no ink.
 *
 * Nothing here talks to the network: the same name always produces the same
 * set of marks, instantly.
 *
 * Fonts: an SVG inside an <img> cannot load webfonts, so the text uses a stack
 * that resolves to a font present in the PDF container (Liberation/DejaVu are
 * installed in the CVPAP image; see its Dockerfile).
 */

export const LOGO_FONT = "Arial, Helvetica, 'Liberation Sans', 'DejaVu Sans', sans-serif";
export const LOGO_SERIF = "Georgia, 'Times New Roman', 'Liberation Serif', 'DejaVu Serif', serif";

export type InkStyle = "line" | "solid";

export interface LogoOptions {
    name: string;
    tagline?: string;
    /** 1–3 letters; derived from the name when empty */
    initials?: string;
    /** key from LOGO_ICONS, or "" for letters only */
    icon?: string;
    color: string;
    ink: InkStyle;
    /** serif letterforms suit invitations/weddings */
    serif?: boolean;
}

export interface LogoVariant {
    id: string;
    label: string;
    svg: string;
    width: number;
    height: number;
    /** true when the mark uses a large solid fill (more ink) */
    heavy?: boolean;
}

// ── helpers ─────────────────────────────────────────────────────────────────

function esc(s: string): string {
    return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function initialsFrom(name: string, max = 2): string {
    const words = (name ?? "")
        .replace(/[^\p{L}\p{N}\s&-]/gu, " ")
        .split(/[\s-]+/)
        .filter((w) => w && !/^(ltd|limited|co|company|the|and|&|enterprises?|services?|shop)$/i.test(w));
    if (words.length === 0) return (name ?? "").trim().slice(0, max).toUpperCase() || "AB";
    if (words.length === 1) return words[0].slice(0, Math.min(max, 2)).toUpperCase();
    return words.slice(0, max).map((w) => w[0]).join("").toUpperCase();
}

/** Rough width of a run of caps, so boxes can hug the text. */
function capsWidth(text: string, size: number, tracking = 0): number {
    return text.length * size * 0.62 + Math.max(0, text.length - 1) * tracking;
}

/** Rough width of mixed-case text at a given size. */
function textWidth(text: string, size: number, tracking = 0): number {
    return text.length * size * 0.55 + Math.max(0, text.length - 1) * tracking;
}

/** Largest size (<= base) at which `text` fits `maxWidth`; never below `min`. */
function fitSize(text: string, maxWidth: number, base: number, min = 11, tracking = 0): number {
    const w = textWidth(text, base, tracking);
    if (w <= maxWidth) return base;
    return Math.max(min, Math.floor((base * maxWidth) / w));
}

function wrap(rawWidth: number, height: number, body: string): string {
    const width = Math.round(rawWidth);
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">${body}</svg>`;
}

function textEl(x: number, y: number, content: string, opts: {
    size: number; color: string; weight?: string | number; anchor?: string; tracking?: number; serif?: boolean; opacity?: number;
}): string {
    const { size, color, weight = 700, anchor = "middle", tracking = 0, serif = false, opacity } = opts;
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" font-family="${serif ? LOGO_SERIF : LOGO_FONT}" font-size="${size}" font-weight="${weight}" letter-spacing="${tracking}" fill="${color}"${opacity !== undefined ? ` opacity="${opacity}"` : ""}>${esc(content)}</text>`;
}

// ── icon set (24×24, stroke art — line work is cheap to print) ──────────────

export interface LogoIcon { key: string; label: string; body: string }

export const LOGO_ICONS: LogoIcon[] = [
    { key: "boda", label: "Boda / motorbike", body: `<circle cx="5.5" cy="17" r="3.4"/><circle cx="18.5" cy="17" r="3.4"/><path d="M5.5 17h4l3.5-6.5H17"/><path d="M13 10.5 11 7.5H8.5"/><path d="M16.5 10.5 18.5 17"/><path d="M14.5 7.5H18"/>` },
    { key: "car", label: "Car / taxi", body: `<path d="M3.5 16.5v-3.2L5.5 8h13l2 5.3v3.2"/><path d="M3.5 16.5h17"/><circle cx="7.5" cy="17.2" r="1.7"/><circle cx="16.5" cy="17.2" r="1.7"/><path d="M6 13h12"/>` },
    { key: "truck", label: "Truck / delivery", body: `<path d="M3 16.5V6.5h11v10"/><path d="M14 9.5h3.8l3.2 3.2v3.8H14"/><circle cx="7.5" cy="17.5" r="1.9"/><circle cx="17.2" cy="17.5" r="1.9"/>` },
    { key: "scissors", label: "Salon / kinyozi", body: `<circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M7.8 16.2 19 4"/><path d="M16.2 16.2 5 4"/>` },
    { key: "comb", label: "Barber", body: `<rect x="4" y="5.5" width="16" height="4" rx="1.2"/><path d="M6.5 9.5v7M10 9.5v7M13.5 9.5v7M17 9.5v7"/>` },
    { key: "shirt", label: "Tailor / boutique", body: `<path d="M8.5 3.5 5 5.5 3 10l3 1.2V20.5h12V11.2L21 10l-2-4.5-3.5-2"/><path d="M8.5 3.5a3.5 3.5 0 0 0 7 0"/>` },
    { key: "hammer", label: "Fundi / carpentry", body: `<path d="M14 3.5 20.5 10l-3 3-6.5-6.5z"/><path d="M11 9.5 3.5 17v3.5H7l7.5-7.5"/>` },
    { key: "wrench", label: "Mechanic / plumbing", body: `<path d="M20 5.2A5 5 0 0 1 13.4 11.8L5.8 19.4a2.1 2.1 0 0 1-3-3l7.6-7.6A5 5 0 0 1 17 2.2l-2.8 2.8 2 2z"/>` },
    { key: "bolt", label: "Electrical", body: `<path d="M13.5 2.5 4.5 14h6.2l-1.2 7.5 9-11.5h-6.2z"/>` },
    { key: "roller", label: "Painting", body: `<rect x="3" y="4" width="11.5" height="5" rx="1.2"/><path d="M14.5 6.5H19v4.2h-6v3.3"/><rect x="10.8" y="14" width="4.4" height="6.5" rx="1.2"/>` },
    { key: "brick", label: "Construction", body: `<rect x="3" y="5" width="18" height="4.6" rx="0.8"/><rect x="3" y="9.6" width="18" height="4.6" rx="0.8"/><rect x="3" y="14.2" width="18" height="4.6" rx="0.8"/><path d="M9 5v4.6M15 9.6v4.6M9 14.2v4.6"/>` },
    { key: "shop", label: "Duka / shop", body: `<path d="M4.5 9.5h15v11h-15z"/><path d="M3 9.5 5.5 3.5h13L21 9.5z"/><path d="M9.5 20.5v-6h5v6"/>` },
    { key: "basket", label: "Groceries", body: `<path d="M4.5 9h15l-1.6 11h-11.8z"/><path d="M8.5 9 12 3l3.5 6"/>` },
    { key: "bag", label: "Retail", body: `<path d="M6 8h12l1.2 12.5H4.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>` },
    { key: "cup", label: "Café / hotel", body: `<path d="M4 8.5h12.5v5.8a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16.5 9.5h2.2a2.4 2.4 0 0 1 0 4.8h-2.2"/><path d="M7 3v2.2M11 3v2.2"/>` },
    { key: "food", label: "Food / catering", body: `<path d="M7 3v8a2 2 0 0 0 4 0V3"/><path d="M9 11v10"/><path d="M17.5 3c-2 2-2 6.5 0 8.5V21"/>` },
    { key: "camera", label: "Photography", body: `<rect x="3" y="7" width="18" height="12.5" rx="2"/><circle cx="12" cy="13.2" r="3.4"/><path d="M8.2 7 9.6 4.2h4.8L15.8 7"/>` },
    { key: "laptop", label: "Cyber / IT", body: `<rect x="4" y="5" width="16" height="10.2" rx="1.2"/><path d="M2 18.2h20"/>` },
    { key: "printer", label: "Printing", body: `<path d="M7 8.5v-5h10v5"/><rect x="3" y="8.5" width="18" height="7.5" rx="1.2"/><path d="M7 13.5h10v7H7z"/>` },
    { key: "book", label: "School / books", body: `<path d="M3.5 4.5H9a3 3 0 0 1 3 1.6 3 3 0 0 1 3-1.6h5.5v14H15a3 3 0 0 0-3 1.6 3 3 0 0 0-3-1.6H3.5z"/><path d="M12 6.1v13"/>` },
    { key: "church", label: "Church", body: `<path d="M12 2v5.2M9.6 4.4h4.8"/><path d="M5 20.5V10l7-3.6 7 3.6v10.5z"/><path d="M10 20.5v-5h4v5"/>` },
    { key: "cross", label: "Clinic / pharmacy", body: `<circle cx="12" cy="12" r="8.8"/><path d="M12 7.2v9.6M7.2 12h9.6"/>` },
    { key: "leaf", label: "Agro / farm", body: `<path d="M12 21v-8.4"/><path d="M12 12.6c0-5 3-8 8-8 0 5-3 8-8 8z"/><path d="M12 16c0-3-2-5-5.8-5 0 3 2 5 5.8 5z"/>` },
    { key: "drop", label: "Water", body: `<path d="M12 3s6 6.4 6 10.4a6 6 0 0 1-12 0C6 9.4 12 3 12 3z"/>` },
    { key: "house", label: "Housing / property", body: `<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.8V20.5h12V9.8"/><path d="M10 20.5v-6h4v6"/>` },
    { key: "shield", label: "Security", body: `<path d="M12 3 5 6v6c0 4.5 3 7.6 7 9 4-1.4 7-4.5 7-9V6z"/>` },
    { key: "dumbbell", label: "Gym", body: `<path d="M3 9v6M6 6.5v11M18 6.5v11M21 9v6M6 12h12"/>` },
    { key: "washer", label: "Laundry", body: `<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="14" r="4.3"/><path d="M7 6.5h1.8M14.5 6.5h2.5"/>` },
    { key: "phone", label: "Phone / airtime", body: `<rect x="6" y="2.2" width="12" height="19.6" rx="2.6"/><path d="M10 5.2h4"/><circle cx="12" cy="18" r="1"/>` },
    { key: "music", label: "Events / DJ", body: `<circle cx="7" cy="17.8" r="2.8"/><circle cx="18" cy="15.8" r="2.8"/><path d="M9.8 17.8V6l11-2v11.8"/>` },
    { key: "gift", label: "Gifts / parties", body: `<rect x="3.5" y="9.5" width="17" height="11" rx="1.2"/><path d="M3.5 13.5h17M12 9.5v11"/><path d="M12 9.5S9.4 4.2 7 6s2.4 3.5 5 3.5zM12 9.5s2.6-5.3 5-3.5-2.4 3.5-5 3.5z"/>` },
    { key: "ring", label: "Wedding", body: `<circle cx="12" cy="15" r="5.4"/><path d="M9.2 7h5.6l-2.8-4z"/><path d="M9.2 7 12 10l2.8-3"/>` },
    { key: "star", label: "Star", body: `<path d="m12 3 2.6 5.5 6 .9-4.3 4.2 1 6-5.3-2.8-5.3 2.8 1-6L3.4 9.4l6-.9z"/>` },
    { key: "globe", label: "General business", body: `<circle cx="12" cy="12" r="8.8"/><path d="M3.2 12h17.6"/><path d="M12 3.2a13.5 13.5 0 0 1 0 17.6 13.5 13.5 0 0 1 0-17.6z"/>` },
];

export const LOGO_COLORS = [
    "#0f766e", "#1d4ed8", "#b45309", "#be123c", "#7c3aed",
    "#065f46", "#0369a1", "#9d174d", "#111827", "#374151",
];

function icon(key: string | undefined): LogoIcon | null {
    return LOGO_ICONS.find((i) => i.key === key) ?? null;
}

// ── logo styles ─────────────────────────────────────────────────────────────

export function generateLogos(opts: LogoOptions): LogoVariant[] {
    const name = (opts.name || "").trim() || "Your Business";
    const tagline = (opts.tagline || "").trim();
    const letters = (opts.initials || initialsFrom(name)).slice(0, 3).toUpperCase();
    const c = opts.color || "#0f766e";
    const solid = opts.ink === "solid";
    const serif = !!opts.serif;
    const ic = icon(opts.icon);
    const fg = solid ? "#ffffff" : c;
    const out: LogoVariant[] = [];

    // 1. initials in a circle
    out.push({
        id: "circle", label: "Circle", width: 120, height: 120, heavy: solid,
        svg: wrap(120, 120, `
            <circle cx="60" cy="60" r="52" ${solid ? `fill="${c}"` : `stroke="${c}" stroke-width="3.5"`} />
            ${textEl(60, 61, letters, { size: letters.length > 2 ? 34 : 42, color: fg, tracking: 1, serif })}`),
    });

    // 2. initials in a rounded square
    out.push({
        id: "square", label: "Rounded square", width: 120, height: 120, heavy: solid,
        svg: wrap(120, 120, `
            <rect x="10" y="10" width="100" height="100" rx="22" ${solid ? `fill="${c}"` : `stroke="${c}" stroke-width="3.5"`} />
            ${textEl(60, 61, letters, { size: letters.length > 2 ? 34 : 42, color: fg, tracking: 1, serif })}`),
    });

    // 3. initials split by a rule
    if (letters.length >= 2) {
        const a = letters[0];
        const b = letters.slice(1);
        out.push({
            id: "split", label: "Split monogram", width: 160, height: 100,
            svg: wrap(160, 100, `
                ${textEl(62, 50, a, { size: 52, color: c, anchor: "end", serif })}
                <path d="M80 18V82" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
                ${textEl(98, 50, b, { size: 52, color: c, anchor: "start", serif })}`),
        });
    }

    // 4. initials over a baseline rule
    out.push({
        id: "underline", label: "Underlined", width: 160, height: 110,
        svg: wrap(160, 110, `
            ${textEl(80, 45, letters, { size: 48, color: c, tracking: 2, serif })}
            <path d="M34 78h92" stroke="${c}" stroke-width="5" stroke-linecap="round"/>
            ${tagline ? textEl(80, 95, tagline.toUpperCase(), { size: fitSize(tagline.toUpperCase(), 140, 11, 7, 3), color: c, weight: 600, tracking: 3, opacity: 0.75 }) : ""}`),
    });

    // 5. hexagon
    out.push({
        id: "hex", label: "Hexagon", width: 120, height: 120, heavy: solid,
        svg: wrap(120, 120, `
            <path d="M60 8 106 34v52L60 112 14 86V34z" ${solid ? `fill="${c}"` : `stroke="${c}" stroke-width="3.5" stroke-linejoin="round"`} />
            ${textEl(60, 61, letters, { size: letters.length > 2 ? 30 : 38, color: fg, tracking: 1, serif })}`),
    });

    if (ic) {
        // 6. icon in a circle
        out.push({
            id: "icon-circle", label: "Icon badge", width: 120, height: 120, heavy: solid,
            svg: wrap(120, 120, `
                <circle cx="60" cy="60" r="52" ${solid ? `fill="${c}"` : `stroke="${c}" stroke-width="3.5"`} />
                <g transform="translate(30 30) scale(2.5)" stroke="${fg}" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round">${ic.body}</g>`),
        });

        // 7. plain icon
        out.push({
            id: "icon-plain", label: "Icon only", width: 120, height: 120,
            svg: wrap(120, 120, `<g transform="translate(12 12) scale(4)" stroke="${c}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round">${ic.body}</g>`),
        });

        // 8. icon + name, horizontal
        {
            const nameSize = fitSize(name, 232, 26, 13);
            const tagSize = tagline ? fitSize(tagline.toUpperCase(), 232, 12, 8, 2.5) : 0;
            const w = Math.max(340, 92 + Math.max(textWidth(name, nameSize), tagline ? textWidth(tagline.toUpperCase(), tagSize, 2.5) : 0) + 16);
            out.push({
                id: "lockup", label: "Icon + name", width: w, height: 96,
                svg: wrap(w, 96, `
                    <g transform="translate(16 24) scale(2)" stroke="${c}" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round">${ic.body}</g>
                    <path d="M76 22V74" stroke="${c}" stroke-width="2" opacity="0.35" stroke-linecap="round"/>
                    ${textEl(92, tagline ? 40 : 48, name, { size: nameSize, color: c, anchor: "start", serif })}
                    ${tagline ? textEl(92, 66, tagline.toUpperCase(), { size: tagSize, color: c, anchor: "start", weight: 600, tracking: 2.5, opacity: 0.7 }) : ""}`),
            });
        }

        // 9. icon above name
        out.push({
            id: "stacked", label: "Stacked", width: 240, height: 180,
            svg: wrap(240, 180, `
                <g transform="translate(96 22) scale(2)" stroke="${c}" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round">${ic.body}</g>
                <path d="M96 92h48" stroke="${c}" stroke-width="3" stroke-linecap="round"/>
                ${textEl(120, 118, name, { size: fitSize(name, 216, 24, 10), color: c, serif })}
                ${tagline ? textEl(120, 146, tagline.toUpperCase(), { size: fitSize(tagline.toUpperCase(), 216, 12, 8, 3), color: c, weight: 600, tracking: 3, opacity: 0.7 }) : ""}`),
        });

        // 10. framed emblem
        out.push({
            id: "emblem", label: "Emblem", width: 240, height: 200,
            svg: wrap(240, 200, `
                <rect x="14" y="14" width="212" height="172" rx="10" stroke="${c}" stroke-width="2.5"/>
                <rect x="22" y="22" width="196" height="156" rx="6" stroke="${c}" stroke-width="1" opacity="0.45"/>
                <g transform="translate(96 40) scale(2)" stroke="${c}" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round">${ic.body}</g>
                <path d="M98 104h44" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>
                ${textEl(120, 130, name, { size: fitSize(name, 186, 22, 10), color: c, serif })}
                ${tagline ? textEl(120, 158, tagline.toUpperCase(), { size: fitSize(tagline.toUpperCase(), 186, 11, 8, 3), color: c, weight: 600, tracking: 3, opacity: 0.7 }) : ""}`),
        });
    }

    // 11. wordmark between rules
    {
        const size = fitSize(name, 260, 27, 12);
        const w = Math.max(340, textWidth(name, size) + 80);
        out.push({
            id: "wordmark", label: "Wordmark", width: w, height: 110,
            svg: wrap(w, 110, `
                <path d="M40 30H${w - 40}" stroke="${c}" stroke-width="2"/>
                ${textEl(w / 2, 57, name, { size, color: c, serif })}
                <path d="M40 84H${w - 40}" stroke="${c}" stroke-width="2"/>
                ${tagline ? textEl(w / 2, 98, tagline.toUpperCase(), { size: fitSize(tagline.toUpperCase(), w - 80, 10, 8, 3), color: c, weight: 600, tracking: 3, opacity: 0.7 }) : ""}`),
        });
    }

    // 12. initials block + name
    {
        const bw = capsWidth(letters, 26, 2) + 30;
        const textX = 16 + bw + 18;
        const nameSize = fitSize(name, 340 - textX - 16, 24, 12);
        const tagSize = tagline ? fitSize(tagline.toUpperCase(), 340 - textX - 16, 11, 8, 2.5) : 0;
        const w = Math.max(340, textX + Math.max(textWidth(name, nameSize), tagline ? textWidth(tagline.toUpperCase(), tagSize, 2.5) : 0) + 16);
        out.push({
            id: "mark-name", label: "Mark + name", width: w, height: 96, heavy: solid,
            svg: wrap(w, 96, `
                <rect x="16" y="24" width="${bw}" height="48" rx="10" ${solid ? `fill="${c}"` : `stroke="${c}" stroke-width="2.5"`} />
                ${textEl(16 + bw / 2, 49, letters, { size: 26, color: fg, tracking: 2, serif })}
                ${textEl(textX, tagline ? 40 : 48, name, { size: nameSize, color: c, anchor: "start", serif })}
                ${tagline ? textEl(textX, 64, tagline.toUpperCase(), { size: tagSize, color: c, anchor: "start", weight: 600, tracking: 2.5, opacity: 0.7 }) : ""}`),
        });
    }

    return out;
}

// ── ornaments (for cards with no photo) ─────────────────────────────────────

export function generateOrnaments(opts: Pick<LogoOptions, "color" | "ink">): LogoVariant[] {
    const c = opts.color || "#b45309";
    const S = 240;
    const line = (d: string, w = 2, o = 1) => `<path d="${d}" stroke="${c}" stroke-width="${w}" opacity="${o}" fill="none" stroke-linecap="round"/>`;

    return [
        {
            id: "frame-corners", label: "Corner frame", width: S, height: S,
            svg: wrap(S, S, `
                ${line("M20 60V28a8 8 0 0 1 8-8h32")}${line("M180 20h32a8 8 0 0 1 8 8v32")}
                ${line("M220 180v32a8 8 0 0 1-8 8h-32")}${line("M60 220H28a8 8 0 0 1-8-8v-32")}
                ${line("M34 70V38a4 4 0 0 1 4-4h32", 1, 0.5)}${line("M170 34h32a4 4 0 0 1 4 4v32", 1, 0.5)}
                ${line("M206 170v32a4 4 0 0 1-4 4h-32", 1, 0.5)}${line("M70 206H38a4 4 0 0 1-4-4v-32", 1, 0.5)}`),
        },
        {
            id: "sunburst", label: "Rays", width: S, height: S,
            svg: wrap(S, S, `${Array.from({ length: 24 }, (_, i) => {
                const a = (i * Math.PI * 2) / 24;
                const r1 = 46, r2 = i % 2 ? 78 : 104;
                return line(`M${120 + Math.cos(a) * r1} ${120 + Math.sin(a) * r1}L${120 + Math.cos(a) * r2} ${120 + Math.sin(a) * r2}`, 2, i % 2 ? 0.45 : 0.9);
            }).join("")}<circle cx="120" cy="120" r="38" stroke="${c}" stroke-width="2.5" fill="none"/>`),
        },
        {
            id: "wreath", label: "Wreath", width: S, height: S,
            svg: wrap(S, S, `
                <circle cx="120" cy="120" r="82" stroke="${c}" stroke-width="2" fill="none" stroke-dasharray="6 10"/>
                <circle cx="120" cy="120" r="70" stroke="${c}" stroke-width="1" opacity="0.5" fill="none"/>
                ${Array.from({ length: 12 }, (_, i) => {
                    const a = (i * Math.PI * 2) / 12;
                    return `<circle cx="${(120 + Math.cos(a) * 94).toFixed(1)}" cy="${(120 + Math.sin(a) * 94).toFixed(1)}" r="3.4" fill="${c}" opacity="0.7"/>`;
                }).join("")}`),
        },
        {
            id: "dots", label: "Dot grid", width: S, height: S,
            svg: wrap(S, S, Array.from({ length: 10 }, (_, r) => Array.from({ length: 10 }, (_, q) =>
                `<circle cx="${20 + q * 22}" cy="${20 + r * 22}" r="${1.6 + ((q + r) % 3) * 0.6}" fill="${c}" opacity="${0.25 + ((q * r) % 4) * 0.15}"/>`).join("")).join("")),
        },
        {
            id: "waves", label: "Waves", width: S, height: 120,
            svg: wrap(S, 120, Array.from({ length: 5 }, (_, i) =>
                line(`M0 ${28 + i * 16}q30 -14 60 0t60 0 60 0 60 0`, 2, 0.85 - i * 0.13)).join("")),
        },
        {
            id: "confetti", label: "Confetti", width: S, height: S,
            svg: wrap(S, S, Array.from({ length: 26 }, (_, i) => {
                const x = ((i * 97) % 220) + 10, y = ((i * 53) % 220) + 10, rot = (i * 37) % 360;
                if (i % 3 === 0) return `<circle cx="${x}" cy="${y}" r="5" stroke="${c}" stroke-width="2" fill="none" opacity="0.8"/>`;
                if (i % 3 === 1) return `<rect x="${x}" y="${y}" width="9" height="9" rx="2" transform="rotate(${rot} ${x + 4} ${y + 4})" fill="${c}" opacity="0.5"/>`;
                return line(`M${x} ${y}l8 8`, 2.4, 0.6);
            }).join("")),
        },
        {
            id: "arch", label: "Arch", width: S, height: S,
            svg: wrap(S, S, `
                <path d="M40 220V110a80 80 0 0 1 160 0v110" stroke="${c}" stroke-width="2.5" fill="none"/>
                <path d="M56 220V110a64 64 0 0 1 128 0v110" stroke="${c}" stroke-width="1" opacity="0.5" fill="none"/>
                ${line("M78 150h84", 1.5, 0.6)}${line("M90 172h60", 1.5, 0.4)}`),
        },
        {
            id: "chevron", label: "Chevrons", width: S, height: 120,
            svg: wrap(S, 120, Array.from({ length: 8 }, (_, i) =>
                line(`M${i * 30} 80l15 -22 15 22`, 3, 0.9 - i * 0.08)).join("")),
        },
    ];
}

// ── output ──────────────────────────────────────────────────────────────────

export function svgDataUri(svg: string): string {
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function svgToFile(svg: string, basename: string): File {
    const safe = (basename || "logo").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "logo";
    return new File([svg], `${safe}.svg`, { type: "image/svg+xml" });
}

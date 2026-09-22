/**
 * Ink saving for print.
 *
 * Inkjets (and the ivory card stock we print on) hate large solid fills: they
 * drink ink, dry slowly and band. This turns any design into a lighter version
 * of itself for printing, without wrecking it:
 *
 *   - big dark panels / gradients  → a pale tint of the same colour
 *   - the card background          → paper white (the ivory stock supplies the tone)
 *   - full-bleed background images → faded (saver) or dropped (max)
 *   - soft shadows                 → removed (they spray ink and print blotchy)
 *   - small accents (rules, dots, icons) are LEFT SOLID — they cost almost
 *     nothing and are what makes the card look designed
 *
 * Text that ends up on a now-light backdrop is darkened so it stays readable.
 * The transform is applied to the print sheet only; the saved design is untouched.
 */
import type { CardElement, TemplateConfig } from "./types";

export type InkMode = "off" | "saver" | "max";

export const INK_MODE_LABELS: Record<InkMode, string> = {
    off: "Off — print as designed",
    saver: "Saver — pale panels, keep photos",
    max: "Max — pale panels, drop background photos",
};

/** A fill covering at least this share of the card counts as a "panel". */
const PANEL_AREA = 0.18;
/** An image covering at least this share counts as a background image. */
const BG_IMAGE_AREA = 0.55;
/** How much of the original colour survives in a tinted panel. */
const TINT_KEEP: Record<Exclude<InkMode, "off">, number> = { saver: 0.16, max: 0.1 };
/** Anything lighter than this is already cheap to print — leave it alone. */
const LIGHT_ENOUGH = 0.82;

interface RGB { r: number; g: number; b: number }

export function parseColor(css: string | undefined | null): RGB | null {
    if (!css) return null;
    const s = css.trim().toLowerCase();
    if (s === "transparent" || s === "none") return null;
    if (s === "white") return { r: 255, g: 255, b: 255 };
    if (s === "black") return { r: 0, g: 0, b: 0 };
    const hex = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hex) {
        const h = hex[1];
        const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
        return { r: parseInt(full.slice(0, 2), 16), g: parseInt(full.slice(2, 4), 16), b: parseInt(full.slice(4, 6), 16) };
    }
    const rgb = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    if (rgb) return { r: +rgb[1], g: +rgb[2], b: +rgb[3] };
    return null;
}

export function toHex({ r, g, b }: RGB): string {
    const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return `#${c(r)}${c(g)}${c(b)}`;
}

/** Relative luminance, 0 (black) … 1 (white). */
export function luminance(rgb: RGB): number {
    const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(rgb.r) + 0.7152 * f(rgb.g) + 0.0722 * f(rgb.b);
}

function mixWithWhite(rgb: RGB, keep: number): RGB {
    return { r: 255 - (255 - rgb.r) * keep, g: 255 - (255 - rgb.g) * keep, b: 255 - (255 - rgb.b) * keep };
}

function darken(rgb: RGB, factor = 0.32): RGB {
    return { r: rgb.r * factor, g: rgb.g * factor, b: rgb.b * factor };
}

/** All colour stops in a gradient string, in order. */
function gradientColors(gradient: string): RGB[] {
    const found = gradient.match(/#[0-9a-fA-F]{3,6}|rgba?\([^)]*\)/g) ?? [];
    return found.map(parseColor).filter((c): c is RGB => !!c);
}

/** Average colour of a fill (solid or gradient), ignoring fully transparent. */
function fillColor(el: CardElement): RGB | null {
    if (el.gradient) {
        const stops = gradientColors(el.gradient);
        if (stops.length === 0) return null;
        return {
            r: stops.reduce((s, c) => s + c.r, 0) / stops.length,
            g: stops.reduce((s, c) => s + c.g, 0) / stops.length,
            b: stops.reduce((s, c) => s + c.b, 0) / stops.length,
        };
    }
    return parseColor(el.backgroundColor);
}

function areaRatio(el: CardElement, cfg: TemplateConfig): number {
    const total = Math.max(1, cfg.width * cfg.height);
    // clip to the card — full-bleed shapes often overhang
    const w = Math.min(el.width, cfg.width - Math.min(el.x, cfg.width));
    const h = Math.min(el.height, cfg.height - Math.min(el.y, cfg.height));
    return Math.max(0, w * h) / total;
}

function covers(el: CardElement, x: number, y: number): boolean {
    return x >= el.x && x <= el.x + el.width && y >= el.y && y <= el.y + el.height;
}

/**
 * Lighten a design for printing. Returns a new config; the input is not mutated.
 */
export function inkSaveConfig(cfg: TemplateConfig, mode: InkMode): TemplateConfig {
    if (mode === "off") return cfg;
    const keep = TINT_KEEP[mode];

    // 1. card background → paper white when it costs ink
    const bg = parseColor(cfg.backgroundColor);
    const bgWasDark = !!bg && luminance(bg) < LIGHT_ENOUGH;
    const newBackground = bgWasDark ? "#ffffff" : cfg.backgroundColor;

    // 2. fills, images, shadows
    const elements: CardElement[] = [];
    for (const el of cfg.elements) {
        const next: CardElement = { ...el };
        if (next.boxShadow) delete next.boxShadow;

        if (el.type === "shape" && !el.iconSvg) {
            const colour = fillColor(el);
            const ratio = areaRatio(el, cfg);
            if (colour && ratio >= PANEL_AREA && luminance(colour) < LIGHT_ENOUGH) {
                const tint = toHex(mixWithWhite(colour, keep));
                delete next.gradient;
                next.backgroundColor = tint;
            }
        }

        if (el.type === "image") {
            const ratio = areaRatio(el, cfg);
            if (ratio >= BG_IMAGE_AREA) {
                if (mode === "max") continue;                       // drop the background image
                next.imageOpacity = Math.min(el.imageOpacity ?? 1, 0.18);
            }
        }

        if (mode === "max" && next.textShadow) delete next.textShadow;

        elements.push(next);
    }

    // 3. text that now sits on a light backdrop must be dark
    const cardBgLum = parseColor(newBackground) ? luminance(parseColor(newBackground)!) : 1;
    const fixed = elements.map((el) => {
        if (el.type !== "text" && el.type !== "save-contact") return el;
        const colour = parseColor(el.color);
        if (!colour || luminance(colour) < 0.55) return el;          // already dark enough

        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        let backdropLum = cardBgLum;
        let overImage = false;
        let topZ = -Infinity;
        for (const other of elements) {
            if (other === el || other.zIndex >= el.zIndex || !covers(other, cx, cy)) continue;
            if (other.zIndex < topZ) continue;
            if (other.type === "shape" && !other.iconSvg) {
                const c = fillColor(other);
                if (!c) continue;
                topZ = other.zIndex;
                backdropLum = luminance(c);
                overImage = false;
            } else if (other.type === "image") {
                topZ = other.zIndex;
                overImage = (other.imageOpacity ?? 1) > 0.4;          // a faded image is see-through
                backdropLum = overImage ? 0.4 : cardBgLum;
            }
        }
        if (overImage || backdropLum < 0.6) return el;                // still dark behind: leave light text
        const isNeutral = Math.max(colour.r, colour.g, colour.b) - Math.min(colour.r, colour.g, colour.b) < 18;
        return { ...el, color: isNeutral ? "#1f2937" : toHex(darken(colour)) };
    });

    return { ...cfg, backgroundColor: newBackground, elements: fixed };
}

/**
 * Rough ink coverage of one card face, 0–1 (share of the area that gets ink,
 * weighted by how dark it is). It's an estimate for comparing designs, not a
 * measurement of millilitres.
 */
export function estimateCoverage(cfg: TemplateConfig): number {
    const total = Math.max(1, cfg.width * cfg.height);
    const bg = parseColor(cfg.backgroundColor);
    let ink = bg ? (1 - luminance(bg)) : 0;   // background covers the whole face

    for (const el of cfg.elements) {
        const ratio = areaRatio(el, cfg);
        const opacity = el.opacity ?? 1;
        if (el.type === "shape") {
            if (el.iconSvg) { ink += ratio * 0.35 * opacity; continue; }
            const c = fillColor(el);
            if (c) ink += ratio * (1 - luminance(c)) * opacity;
        } else if (el.type === "image") {
            // photos average out around mid-tone
            ink += ratio * 0.55 * (el.imageOpacity ?? 1) * opacity;
        } else if (el.type === "qrcode") {
            ink += ratio * 0.45 * opacity;
        } else if (el.type === "text" || el.type === "save-contact") {
            const c = parseColor(el.color);
            // glyphs wet maybe a sixth of their box
            if (c) ink += ratio * (1 - luminance(c)) * 0.16 * opacity;
        }
        void total;
    }
    return Math.max(0, Math.min(1, ink));
}

/** Coverage of a card's faces, averaged over the faces that get printed. */
export function estimateCardCoverage(front: TemplateConfig, back: TemplateConfig | null, includeBack: boolean): number {
    const faces = [front, ...(includeBack && back ? [back] : [])];
    return faces.reduce((s, f) => s + estimateCoverage(f), 0) / faces.length;
}

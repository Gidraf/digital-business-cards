/**
 * Static HTML renderer for a card face — the print/export twin of
 * CardPreviewRenderer (React). Output is self-contained: every image `src`
 * passed in should already be a data URI or a reachable URL.
 */
import type { CardData, CardElement, TemplateConfig } from "./types";
import { getGoogleFontsUrl, getUsedFonts } from "./fonts";

export interface RenderImages {
    logo?: string | null;
    photo?: string | null;
    /** keyed by asset id (imageSource "asset:<id>") */
    assets?: Record<string, string | null | undefined>;
    /** data URI of the QR code (already generated for this card) */
    qr?: string | null;
    /** data URI for the vCard (save-contact button) */
    vcf?: string | null;
}

/** Multi-line text boxes (message, purpose, body…) wrap; single-line fields ellipsize. */
export function textWraps(el: CardElement): boolean {
    return el.height > (el.fontSize ?? 14) * 1.8;
}

export function escapeHtml(s: string): string {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function getDisplayText(el: CardElement, data: CardData): string {
    if (el.type === "save-contact") return el.customText ?? "Save Contact";
    if (el.type !== "text") return "";
    if (!el.boundField || el.boundField === "custom") return el.customText ?? "";
    if (el.boundField.startsWith("custom:")) {
        const key = el.boundField.slice(7);
        return data.custom_fields?.[key] ?? "";
    }
    const v = data[el.boundField];
    return typeof v === "string" ? v : "";
}

export function resolveLink(el: CardElement, data: CardData): string | null {
    if (el.linkBoundField) {
        const v = data[el.linkBoundField];
        const value = typeof v === "string" ? v : "";
        if (!value) return null;
        if (el.linkBoundField === "email") return `mailto:${value}`;
        if (el.linkBoundField === "phone") return `tel:${value}`;
        if (el.linkBoundField === "website") return value.startsWith("http") ? value : `https://${value}`;
    }
    return el.linkUrl ?? null;
}

export function resolveImageSrc(el: CardElement, data: CardData, images: RenderImages): string | null {
    const src = el.imageSource;
    if (!src || src === "logo") return images.logo ?? data.logoUrl ?? null;
    if (src === "photo") return images.photo ?? data.photoUrl ?? null;
    if (src.startsWith("asset:data:")) return src.slice(6);
    if (src.startsWith("asset:")) return images.assets?.[src.slice(6)] ?? null;
    return null;
}

function linkedText(el: CardElement, text: string, interactive: boolean): string {
    const safe = escapeHtml(text);
    if (!interactive) return safe;
    if (el.boundField === "email") return `<a href="mailto:${safe}" style="color:inherit;text-decoration:none;">${safe}</a>`;
    if (el.boundField === "phone") return `<a href="tel:${safe}" style="color:inherit;text-decoration:none;">${safe}</a>`;
    if (el.boundField === "website") {
        const href = text.startsWith("http") ? text : `https://${text}`;
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${safe}</a>`;
    }
    return safe;
}

export interface RenderOptions {
    /** clickable links + save-contact button (web export). Print: false. */
    interactive?: boolean;
    /** "nowrap" (web card, single line) or "wrap" (print, multi-line text boxes) */
    textMode?: "nowrap" | "wrap";
}

export function renderElementHtml(el: CardElement, data: CardData, images: RenderImages, opts: RenderOptions = {}): string {
    const interactive = opts.interactive ?? false;
    const opacity = el.opacity !== undefined ? `opacity:${el.opacity};` : "";
    const rotation = el.rotation ? `transform:rotate(${el.rotation}deg);` : "";
    const shadow = el.boxShadow ? `box-shadow:${el.boxShadow};` : "";
    const baseStyle = `position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;z-index:${el.zIndex};${opacity}${rotation}${shadow}`;

    if (el.type === "text") {
        const text = getDisplayText(el, data);
        if (el.hideIfEmpty && !text) return "";
        const align = el.textAlign ?? "left";
        const justify = align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";
        const letterSpacing = el.letterSpacing ? `letter-spacing:${el.letterSpacing}px;` : "";
        const lineHeight = el.lineHeight ? `line-height:${el.lineHeight};` : "";
        const textTransform = el.textTransform && el.textTransform !== "none" ? `text-transform:${el.textTransform};` : "";
        const textShadow = el.textShadow ? `text-shadow:${el.textShadow};` : "";
        const wrap = textWraps(el);
        const whiteSpace = wrap ? "white-space:pre-wrap;word-break:break-word;" : "white-space:nowrap;text-overflow:ellipsis;";
        const style = `${baseStyle}display:flex;align-items:center;justify-content:${justify};text-align:${align};font-size:${el.fontSize ?? 14}px;font-family:${el.fontFamily ?? "sans-serif"};font-weight:${el.fontWeight ?? "normal"};color:${el.color ?? "#000"};overflow:hidden;${whiteSpace}${letterSpacing}${lineHeight}${textTransform}${textShadow}`;
        return `<div style="${style}"><span style="display:block;width:100%;">${linkedText(el, text, interactive)}</span></div>`;
    }

    if (el.type === "image") {
        const src = resolveImageSrc(el, data, images);
        const radius = el.borderRadius ?? 0;
        const fit = el.objectFit ?? "contain";
        const imgOpacity = el.imageOpacity !== undefined ? `opacity:${el.imageOpacity};` : "";
        const border = el.border ? `border:${el.border};` : "";
        if (src) {
            const img = `<img src="${escapeHtml(src)}" alt="" style="width:100%;height:100%;object-fit:${fit};border-radius:${radius}px;${imgOpacity}display:block;" />`;
            const link = interactive ? resolveLink(el, data) : null;
            if (link) {
                return `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" style="${baseStyle}overflow:hidden;border-radius:${radius}px;display:block;${border}">${img}</a>`;
            }
            return `<div style="${baseStyle}overflow:hidden;border-radius:${radius}px;${border}">${img}</div>`;
        }
        // no image available: never print a placeholder box (the designer shows one, output doesn't)
        return "";
    }

    if (el.type === "shape") {
        if (el.iconSvg) {
            const color = el.iconColor ?? "#000";
            const svg = el.iconSvg.replace(/currentColor/g, color);
            const link = interactive ? resolveLink(el, data) : null;
            const inner = `<div style="${baseStyle}display:flex;align-items:center;justify-content:center;color:${color};">${svg}</div>`;
            return link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">${inner}</a>` : inner;
        }
        const bg = el.gradient || el.backgroundColor || "#3b82f6";
        const style = `${baseStyle}background:${bg};border-radius:${el.shapeRadius ?? 0}px;border:${el.border ?? "none"};`;
        return `<div style="${style}"></div>`;
    }

    if (el.type === "qrcode") {
        if (images.qr) {
            return `<div style="${baseStyle}"><img src="${images.qr}" alt="QR" style="width:100%;height:100%;object-fit:contain;display:block;" /></div>`;
        }
        return `<div style="${baseStyle}background:#e4e4e7;"></div>`;
    }

    if (el.type === "save-contact") {
        if (!interactive) return "";
        const style = `${baseStyle}display:flex;align-items:center;gap:4px;cursor:pointer;font-size:${el.fontSize ?? 12}px;font-family:${el.fontFamily ?? "sans-serif"};font-weight:${el.fontWeight ?? "500"};color:${el.color ?? "#3b82f6"};text-decoration:none;`;
        return `<a href="${images.vcf ?? "#"}" download="contact.vcf" style="${style}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      ${escapeHtml(el.customText ?? "Save Contact")}</a>`;
    }

    return "";
}

/** The card face as an absolutely-positioned block of `config.width × config.height` px. */
export function renderFaceHtml(config: TemplateConfig, data: CardData, images: RenderImages, opts: RenderOptions = {}, extraStyle = ""): string {
    const sorted = [...config.elements].sort((a, b) => a.zIndex - b.zIndex);
    const elements = sorted.map((el) => renderElementHtml(el, data, images, opts)).join("\n");
    return `<div class="card-face" style="position:relative;width:${config.width}px;height:${config.height}px;background:${config.backgroundColor};overflow:hidden;${extraStyle}">${elements}</div>`;
}

/** A standalone, responsive web page for one card (digital export). */
export function renderCardPageHtml(config: TemplateConfig, data: CardData, images: RenderImages, title: string): string {
    const fontsUrl = getGoogleFontsUrl(getUsedFonts(config.elements));
    const face = renderFaceHtml(config, data, images, { interactive: true }, "position:absolute;top:0;left:0;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.1);transform-origin:top left;");
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
${fontsUrl ? `<link rel="stylesheet" href="${fontsUrl}">` : ""}
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: ${config.pageBackgroundColor ?? "#f4f4f5"}; padding: 20px; }
.card-outer { position: relative; flex-shrink: 0; }
</style>
</head>
<body>
<div class="card-outer" id="card-outer">
${face}
</div>
<script>
(function () {
  var W = ${config.width}, H = ${config.height};
  function scale() {
    var avail = Math.min(window.innerWidth - 40, W);
    var s = avail / W;
    var outer = document.getElementById('card-outer');
    var card = outer.querySelector('.card-face');
    outer.style.width = avail + 'px';
    outer.style.height = (H * s) + 'px';
    card.style.transform = 'scale(' + s + ')';
  }
  scale();
  window.addEventListener('resize', scale);
})();
</script>
</body>
</html>`;
}

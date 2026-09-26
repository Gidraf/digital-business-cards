/**
 * Applying a colour theme to a card template.
 *
 * The palette comes from CVPAP (`/ai/theme`), which matches a company's brand
 * where it knows it and guarantees the result is printable — near-white
 * background, text that clears WCAG AA against it, accents that are not just
 * black ink. This maps those five slots onto an existing template without
 * disturbing the layout.
 *
 * The mapping is deliberately conservative: the theme changes what things look
 * like, never where they sit or what they say.
 */
import { parseColor, luminance } from "./ink";
import type { CardElement, TemplateConfig } from "./types";

export type Palette = {
	primary: string;
	accent: string;
	text: string;
	background: string;
	muted: string;
};

export type ThemeResponse = {
	palette: Palette;
	source: "brand" | "suggested" | "fallback";
	adjusted: string[];
	ink_estimate: number;
};

/** A colour close enough to black or grey that it was never a brand choice. */
function isNeutral(css: string | undefined | null): boolean {
	const rgb = parseColor(css);
	if (!rgb) return true;
	const { r, g, b } = rgb;
	const spread = Math.max(r, g, b) - Math.min(r, g, b);
	// Low saturation: a grey, black or near-white rather than a hue.
	return spread <= 24;
}

/** Is this element dark enough to be body text rather than a highlight? */
function isDarkText(css: string | undefined | null): boolean {
	const rgb = parseColor(css);
	return rgb ? luminance(rgb) < 0.5 : true;
}

function themeElement(element: CardElement, palette: Palette, index: number): CardElement {
	// Shapes are the card's blocks of colour — bars, rules, badges. They carry
	// the brand, alternating so a card does not become one flat slab.
	if (element.type === "shape") {
		const next = index % 3 === 2 ? palette.accent : palette.primary;
		return { ...element, backgroundColor: next };
	}

	if (element.type === "text" || element.type === "save-contact") {
		// Neutral dark text stays text; anything already coloured was a highlight
		// and becomes the brand colour. Light-on-dark text would vanish against a
		// now-white card, so it is darkened to the theme's text colour.
		if (!isNeutral(element.color)) return { ...element, color: palette.primary };
		if (!isDarkText(element.color)) return { ...element, color: palette.text };
		return { ...element, color: palette.text };
	}

	if (element.type === "qrcode") {
		// A QR code needs maximum contrast to scan, so it stays black on white
		// whatever the theme says.
		return element;
	}

	// Images keep their own colours — recolouring a logo would be wrong.
	return element;
}

/**
 * Return a copy of `config` wearing `palette`. Layout, sizes, bound fields and
 * text are untouched.
 */
export function applyPalette(config: TemplateConfig, palette: Palette): TemplateConfig {
	let shapeIndex = 0;
	return {
		...config,
		backgroundColor: palette.background,
		// The page behind the card stays a neutral surface, not brand colour —
		// it is not printed, it is only the preview backdrop.
		pageBackgroundColor: config.pageBackgroundColor,
		elements: config.elements.map((element) => {
			const themed = themeElement(element, palette, element.type === "shape" ? shapeIndex : 0);
			if (element.type === "shape") shapeIndex += 1;
			return themed;
		}),
	};
}

/** Human-readable note about where a palette came from. */
export function describeSource(source: ThemeResponse["source"], company: string): string {
	switch (source) {
		case "brand":
			return `Matched to ${company}'s brand colours.`;
		case "suggested":
			return `Designed to suit ${company}.`;
		default:
			return "Using a professional default — the colour service was unavailable.";
	}
}

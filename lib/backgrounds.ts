/**
 * Card backgrounds beyond a flat fill.
 *
 * A single solid colour is what makes a business card look unfinished, and the
 * obvious fix — a dark full-bleed photo or a heavy gradient — is exactly what an
 * inkjet cannot afford. These presets are built to sit in between: most of the
 * card stays pale enough to leave the paper largely unprinted, with the colour
 * concentrated in a band or corner where it does the work.
 *
 * Each preset carries an `ink` weight so the studio can show the cost, and the
 * trades are named the way a Kenyan operator would recognise them — water,
 * gas, hardware, salon — so picking one is a matter of saying what the business
 * does rather than reading colour theory.
 */
export type BackgroundKind = "solid" | "linear" | "radial";

export type CardBackground = {
	kind: BackgroundKind;
	/** CSS value for `background`. Works in the designer, print HTML and PDF. */
	css: string;
	/** Roughly how much of the card is inked, 0..1 — for the ink estimate. */
	ink: number;
	/** A text colour that stays readable on this background. */
	suggestedText: string;
};

export type BackgroundPreset = CardBackground & {
	key: string;
	label: string;
	/** Trades this suits, for grouping in the picker. */
	trades: string[];
};

/**
 * Light presets keep the card mostly paper. The colour is angled into one
 * corner or edge so a logo and name still sit on white.
 */
export const BACKGROUND_PRESETS: BackgroundPreset[] = [
	{
		key: "plain",
		label: "Plain white",
		kind: "solid",
		css: "#ffffff",
		ink: 0.0,
		suggestedText: "#111827",
		trades: ["any"],
	},
	{
		key: "water_cool",
		label: "Cool water",
		kind: "linear",
		css: "linear-gradient(135deg, #ffffff 0%, #eff6ff 55%, #bfdbfe 100%)",
		ink: 0.12,
		suggestedText: "#0c4a6e",
		trades: ["water", "delivery", "cleaning"],
	},
	{
		key: "water_deep",
		label: "Deep water band",
		kind: "linear",
		css: "linear-gradient(180deg, #ffffff 0%, #ffffff 62%, #1e6091 62%, #14496e 100%)",
		ink: 0.3,
		suggestedText: "#0c4a6e",
		trades: ["water", "delivery"],
	},
	{
		key: "gas_warm",
		label: "Warm flame",
		kind: "linear",
		css: "linear-gradient(135deg, #ffffff 0%, #fff7ed 50%, #fed7aa 100%)",
		ink: 0.13,
		suggestedText: "#7c2d12",
		trades: ["gas", "food", "catering"],
	},
	{
		key: "gas_ember",
		label: "Ember corner",
		kind: "radial",
		css: "radial-gradient(circle at 100% 0%, #fb923c 0%, #fed7aa 28%, #ffffff 62%)",
		ink: 0.18,
		suggestedText: "#7c2d12",
		trades: ["gas", "food"],
	},
	{
		key: "hardware_steel",
		label: "Brushed steel",
		kind: "linear",
		css: "linear-gradient(135deg, #ffffff 0%, #f1f5f9 45%, #cbd5e1 100%)",
		ink: 0.14,
		suggestedText: "#1e293b",
		trades: ["hardware", "fundi", "construction", "mechanic"],
	},
	{
		key: "hardware_amber",
		label: "Safety amber",
		kind: "linear",
		css: "linear-gradient(120deg, #ffffff 0%, #ffffff 58%, #fbbf24 58%, #f59e0b 100%)",
		ink: 0.22,
		suggestedText: "#1e293b",
		trades: ["hardware", "construction", "electrical"],
	},
	{
		key: "butchery_red",
		label: "Butchery red",
		kind: "linear",
		css: "linear-gradient(135deg, #ffffff 0%, #fef2f2 55%, #fecaca 100%)",
		ink: 0.12,
		suggestedText: "#7f1d1d",
		trades: ["butchery", "food", "groceries"],
	},
	{
		key: "salon_rose",
		label: "Salon rose",
		kind: "linear",
		css: "linear-gradient(135deg, #ffffff 0%, #fdf2f8 50%, #fbcfe8 100%)",
		ink: 0.12,
		suggestedText: "#831843",
		trades: ["salon", "kinyozi", "boutique"],
	},
	{
		key: "green_fresh",
		label: "Fresh green",
		kind: "linear",
		css: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 52%, #bbf7d0 100%)",
		ink: 0.12,
		suggestedText: "#14532d",
		trades: ["groceries", "agrovet", "farm"],
	},
	{
		key: "slate_pro",
		label: "Professional slate",
		kind: "linear",
		css: "linear-gradient(135deg, #ffffff 0%, #f8fafc 50%, #e2e8f0 100%)",
		ink: 0.1,
		suggestedText: "#0f172a",
		trades: ["any", "office", "consulting", "cyber"],
	},
	{
		key: "corner_accent",
		label: "Corner accent",
		kind: "radial",
		css: "radial-gradient(circle at 0% 100%, #1e293b 0%, #334155 14%, #ffffff 34%)",
		ink: 0.16,
		suggestedText: "#0f172a",
		trades: ["any", "office"],
	},
];

/** Presets suited to a trade, with the general-purpose ones last. */
export function backgroundsForTrade(trade?: string | null): BackgroundPreset[] {
	const wanted = (trade ?? "").trim().toLowerCase();
	if (!wanted) return BACKGROUND_PRESETS;
	const matches = BACKGROUND_PRESETS.filter((p) => p.trades.some((t) => t !== "any" && wanted.includes(t)));
	const rest = BACKGROUND_PRESETS.filter((p) => !matches.includes(p));
	return [...matches, ...rest];
}

export function backgroundByKey(key: string | null | undefined): BackgroundPreset | null {
	if (!key) return null;
	return BACKGROUND_PRESETS.find((p) => p.key === key) ?? null;
}

/**
 * Guess a trade from what the operator has already typed, so the picker opens
 * on something relevant instead of a wall of swatches.
 */
const TRADE_HINTS: Record<string, string[]> = {
	water: ["water", "maji", "refill", "borehole"],
	gas: ["gas", "lpg", "cylinder"],
	hardware: ["hardware", "fundi", "tools", "timber", "cement"],
	butchery: ["butcher", "nyama", "meat"],
	salon: ["salon", "kinyozi", "barber", "beauty", "spa"],
	groceries: ["grocer", "mboga", "duka", "shop", "supermarket"],
	delivery: ["delivery", "boda", "courier", "transport"],
	cyber: ["cyber", "print", "computer", "internet"],
	construction: ["construction", "build", "contractor"],
	mechanic: ["mechanic", "garage", "auto", "motor"],
};

export function guessTrade(...text: (string | undefined | null)[]): string | null {
	const haystack = text.filter(Boolean).join(" ").toLowerCase();
	if (!haystack.trim()) return null;
	for (const [trade, hints] of Object.entries(TRADE_HINTS)) {
		if (hints.some((h) => haystack.includes(h))) return trade;
	}
	return null;
}

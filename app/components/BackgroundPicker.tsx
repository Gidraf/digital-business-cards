"use client";

import { useMemo, useState } from "react";
import {
	BACKGROUND_PRESETS,
	backgroundsForTrade,
	guessTrade,
	type BackgroundPreset,
} from "@/lib/backgrounds";

/**
 * Choosing the card's background.
 *
 * Built to be noticed rather than discovered: the suggested options are shown
 * open, already narrowed to the trade read from what has been typed, so an
 * operator who has never heard of this feature still ends up with a card that
 * suits the business. "Aurora Waters Refilling" opens on the water presets.
 *
 * Every preset keeps most of the card as paper — the ink cost is shown next to
 * each one, because on an inkjet that is the difference between a card worth
 * printing and one that is not.
 */

const TRADE_LABELS: Record<string, string> = {
	water: "a water business",
	gas: "a gas business",
	hardware: "a hardware business",
	butchery: "a butchery",
	salon: "a salon or kinyozi",
	groceries: "a shop or grocery",
	delivery: "a delivery business",
	cyber: "a cyber or printing business",
	construction: "a construction business",
	mechanic: "a garage",
};

type Props = {
	/** Anything already typed — business name, tagline — used to guess the trade. */
	hints: (string | undefined | null)[];
	/** Currently applied preset key, if any. */
	value?: string | null;
	onPick: (preset: BackgroundPreset) => void;
};

export default function BackgroundPicker({ hints, value, onPick }: Props) {
	const [showAll, setShowAll] = useState(false);

	const trade = useMemo(() => guessTrade(...hints), [hints]);
	const ordered = useMemo(() => backgroundsForTrade(trade), [trade]);

	// With a trade detected the first few are the relevant ones, so showing a
	// short row is enough; without one, a wider spread is more useful.
	const suggested = ordered.slice(0, trade ? 4 : 6);
	const shown = showAll ? BACKGROUND_PRESETS : suggested;

	return (
		<div className="rounded-xl border border-zinc-200 bg-white p-3">
			<div className="mb-2 flex items-center justify-between gap-2">
				<p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Background</p>
				<button
					type="button"
					onClick={() => setShowAll((v) => !v)}
					className="text-xs text-zinc-500 hover:underline"
				>
					{showAll ? "Show suggested" : `Show all ${BACKGROUND_PRESETS.length}`}
				</button>
			</div>

			{trade && !showAll && (
				<p className="mb-2 text-xs text-zinc-600">
					Looks like <span className="font-medium">{TRADE_LABELS[trade] ?? "this trade"}</span> — these suit it:
				</p>
			)}

			<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
				{shown.map((preset) => {
					const selected = value === preset.key;
					return (
						<button
							key={preset.key}
							type="button"
							onClick={() => onPick(preset)}
							title={`${preset.label} — about ${Math.round(preset.ink * 100)}% ink`}
							className={`group rounded-lg border-2 p-1 text-left transition ${
								selected ? "border-[#FF6B35]" : "border-zinc-200 hover:border-zinc-400"
							}`}
						>
							{/* The swatch is the real CSS, so what is picked is what prints. */}
							<span
								className="block h-10 w-full rounded"
								style={{ background: preset.css, border: "1px solid rgba(0,0,0,0.06)" }}
							/>
							<span className="mt-1 block truncate text-[11px] font-medium text-zinc-700">{preset.label}</span>
							<span className="block text-[10px] text-zinc-400">{Math.round(preset.ink * 100)}% ink</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}

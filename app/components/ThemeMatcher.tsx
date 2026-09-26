"use client";

import { useState } from "react";
import { clientApi } from "@/lib/api";
import { applyPalette, describeSource, type Palette, type ThemeResponse } from "@/lib/theme";
import type { TemplateConfig } from "@/lib/types";

/**
 * Pick a colour theme by typing a company name.
 *
 * The palette comes back from CVPAP already forced into something an inkjet can
 * print — near-white background, legible text, accents that are not just black
 * ink. Any correction it had to make is shown, so the operator knows the theme
 * was adjusted rather than wondering why it does not match the website.
 *
 * Applying is explicit: the palette is previewed as swatches first, because it
 * rewrites colours across every element on the card.
 */
type Props = {
	/** Prefilled from the company on the design, when there is one. */
	defaultCompany?: string;
	config: TemplateConfig;
	onApply: (next: TemplateConfig) => void;
};

export default function ThemeMatcher({ defaultCompany = "", config, onApply }: Props) {
	const [open, setOpen] = useState(false);
	const [company, setCompany] = useState(defaultCompany);
	const [result, setResult] = useState<ThemeResponse | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function suggest() {
		if (!company.trim()) {
			setError("Type a company name first.");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			setResult(await clientApi().aiTheme(company.trim()));
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not suggest a theme right now");
		} finally {
			setBusy(false);
		}
	}

	const swatches: (keyof Palette)[] = ["primary", "accent", "text", "background", "muted"];

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:border-zinc-400"
			>
				🎨 Match a company theme
			</button>
		);
	}

	return (
		<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
			<div className="flex flex-wrap items-center gap-2">
				<input
					value={company}
					onChange={(e) => setCompany(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") void suggest();
					}}
					placeholder="Company name"
					className="min-w-[160px] flex-1 rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-500"
				/>
				<button
					type="button"
					onClick={suggest}
					disabled={busy}
					className="rounded-md bg-[#1A1128] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
				>
					{busy ? "Looking…" : "Suggest"}
				</button>
				<button
					type="button"
					onClick={() => {
						setOpen(false);
						setResult(null);
						setError(null);
					}}
					className="text-xs text-zinc-500 hover:underline"
				>
					Close
				</button>
			</div>

			{error && <p className="mt-2 text-xs text-red-600">{error}</p>}

			{result && (
				<div className="mt-2">
					<div className="flex items-center gap-1.5">
						{swatches.map((slot) => (
							<span
								key={slot}
								title={`${slot}: ${result.palette[slot]}`}
								className="h-6 w-6 rounded border border-zinc-300"
								style={{ backgroundColor: result.palette[slot] }}
							/>
						))}
						<span className="ml-1 text-xs text-zinc-600">
							{describeSource(result.source, company.trim())}
						</span>
					</div>

					{result.adjusted.length > 0 && (
						// Shown rather than applied quietly: the operator should know the
						// brand colours were changed, and why.
						<ul className="mt-1.5 list-inside list-disc text-[11px] text-zinc-500">
							{result.adjusted.map((note) => (
								<li key={note}>{note}</li>
							))}
						</ul>
					)}

					<p className="mt-1 text-[11px] text-zinc-500">
						Estimated ink use: {Math.round(result.ink_estimate * 100)}%
					</p>

					<button
						type="button"
						onClick={() => {
							onApply(applyPalette(config, result.palette));
							setOpen(false);
							setResult(null);
						}}
						className="mt-2 rounded-md bg-[#FF6B35] px-2.5 py-1 text-xs font-medium text-white"
					>
						Apply to this card
					</button>
				</div>
			)}
		</div>
	);
}

"use client";

import { useState } from "react";
import { clientApi } from "@/lib/api";

/**
 * Writing help for the long-form fields on a card — a harambee appeal, a flyer's
 * body copy, the message on an invitation.
 *
 * Two deliberately different actions: **Write** drafts from the details already
 * entered, **Fix grammar** corrects what is there without rewriting it. The
 * second matters because an operator typing a customer's own words should be
 * able to tidy them without having them replaced.
 *
 * Nothing is applied silently — a draft is shown for approval first, so the
 * operator stays responsible for what goes on the card.
 */

/** Fields AI writes for, mirroring GENERATABLE in the CVPAP cards AI view. */
const GENERATABLE: Record<string, string[]> = {
	harambee: ["purpose", "message"],
	flyer: ["body_text", "headline", "subheadline", "offer_text", "cta_text"],
	event: ["message"],
	birthday: ["message"],
	baby_shower: ["message"],
	wedding: ["message"],
	business_card: ["tagline"],
};

export function aiSupportsField(kind: string, field: string): boolean {
	return GENERATABLE[kind]?.includes(field) ?? false;
}

type Language = "en" | "sw" | "both";

const LANGUAGES: { value: Language; label: string }[] = [
	{ value: "en", label: "English" },
	{ value: "sw", label: "Kiswahili" },
	{ value: "both", label: "Both" },
];

type Props = {
	kind: string;
	field: string;
	value: string;
	/** Other fields already filled in, so the draft uses real details. */
	context: Record<string, unknown>;
	onApply: (text: string) => void;
};

export default function AiTextHelper({ kind, field, value, context, onApply }: Props) {
	const [open, setOpen] = useState(false);
	const [language, setLanguage] = useState<Language>("en");
	const [notes, setNotes] = useState("");
	const [draft, setDraft] = useState<string | null>(null);
	const [busy, setBusy] = useState<null | "write" | "polish">(null);
	const [error, setError] = useState<string | null>(null);
	const [note, setNote] = useState<string | null>(null);

	if (!aiSupportsField(kind, field)) return null;

	async function write() {
		setBusy("write");
		setError(null);
		setNote(null);
		try {
			const res = await clientApi().aiText({ kind, field, language, notes: notes.trim(), context });
			setDraft(res.text);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not write that right now");
		} finally {
			setBusy(null);
		}
	}

	async function polish() {
		if (!value.trim()) {
			setError("Nothing to fix yet — type something first.");
			return;
		}
		setBusy("polish");
		setError(null);
		setNote(null);
		try {
			const res = await clientApi().aiPolish(value);
			if (res.changed) setDraft(res.text);
			else setNote("Already reads correctly — nothing to change.");
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not check that right now");
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className="mt-1.5">
			{!open ? (
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="text-xs font-medium text-[#FF6B35] hover:underline"
				>
					✨ Help me write this
				</button>
			) : (
				<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-2.5">
					<div className="flex flex-wrap items-center gap-2">
						<select
							value={language}
							onChange={(e) => setLanguage(e.target.value as Language)}
							className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs"
							aria-label="Language"
						>
							{LANGUAGES.map((l) => (
								<option key={l.value} value={l.value}>
									{l.label}
								</option>
							))}
						</select>

						<button
							type="button"
							onClick={write}
							disabled={busy !== null}
							className="rounded-md bg-[#1A1128] px-2.5 py-1 text-xs font-medium text-white disabled:opacity-50"
						>
							{busy === "write" ? "Writing…" : "Write"}
						</button>

						<button
							type="button"
							onClick={polish}
							disabled={busy !== null}
							className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 disabled:opacity-50"
						>
							{busy === "polish" ? "Checking…" : "Fix grammar"}
						</button>

						<button
							type="button"
							onClick={() => {
								setOpen(false);
								setDraft(null);
								setError(null);
								setNote(null);
							}}
							className="ml-auto text-xs text-zinc-500 hover:underline"
						>
							Close
						</button>
					</div>

					<input
						value={notes}
						onChange={(e) => setNotes(e.target.value)}
						placeholder="Anything it should say? e.g. school fees for Form 2"
						className="mt-2 w-full rounded-md border border-zinc-300 px-2 py-1 text-xs outline-none focus:border-zinc-500"
					/>

					{error && <p className="mt-2 text-xs text-red-600">{error}</p>}
					{note && <p className="mt-2 text-xs text-zinc-600">{note}</p>}

					{draft !== null && (
						<div className="mt-2">
							{/* Shown for approval rather than applied straight away: the
							    operator is the one answering for what the card says. */}
							<p className="whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-2 text-xs text-zinc-800">
								{draft}
							</p>
							<div className="mt-1.5 flex gap-2">
								<button
									type="button"
									onClick={() => {
										onApply(draft);
										setDraft(null);
										setOpen(false);
									}}
									className="rounded-md bg-[#FF6B35] px-2.5 py-1 text-xs font-medium text-white"
								>
									Use this
								</button>
								<button
									type="button"
									onClick={write}
									disabled={busy !== null}
									className="rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs text-zinc-700 disabled:opacity-50"
								>
									Try again
								</button>
								<button
									type="button"
									onClick={() => setDraft(null)}
									className="rounded-md px-2.5 py-1 text-xs text-zinc-500"
								>
									Discard
								</button>
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

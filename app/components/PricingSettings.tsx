"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi, ApiError } from "@/lib/api";
import { KIND_LIST } from "@/lib/card-kinds";
import { money, pricePerCard, type Pricing, type KindPricing } from "@/lib/pricing";
import type { CardKind } from "@/lib/types";
import { useToast } from "./ToastProvider";

interface PricingSettingsProps {
    initial: Pricing;
    defaults: Pricing;
}

function cloneKind(k?: KindPricing): KindPricing {
    return { unit_price: k?.unit_price ?? 0, min_quantity: k?.min_quantity ?? 1, tiers: (k?.tiers ?? []).map((t) => ({ ...t })) };
}

export default function PricingSettings({ initial, defaults }: PricingSettingsProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [pricing, setPricing] = useState<Pricing>(() => ({
        currency: initial.currency || "KES",
        design_fee: initial.design_fee ?? 0,
        kinds: Object.fromEntries(KIND_LIST.map((k) => [k.kind, cloneKind(initial.kinds[k.kind] ?? defaults.kinds[k.kind])])) as Pricing["kinds"],
    }));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cur = pricing.currency || "KES";

    function updateKind(kind: CardKind, patch: Partial<KindPricing>) {
        setPricing((p) => ({ ...p, kinds: { ...p.kinds, [kind]: { ...cloneKind(p.kinds[kind]), ...patch } } }));
    }
    function updateTier(kind: CardKind, idx: number, patch: Partial<{ per_sheet: number; price: number }>) {
        const k = cloneKind(pricing.kinds[kind]);
        k.tiers[idx] = { ...k.tiers[idx], ...patch };
        updateKind(kind, { tiers: k.tiers });
    }
    function addTier(kind: CardKind) {
        const k = cloneKind(pricing.kinds[kind]);
        const last = k.tiers[k.tiers.length - 1];
        k.tiers.push({ per_sheet: last ? last.per_sheet * 2 : 1, price: last ? Math.max(1, Math.round(last.price / 2)) : k.unit_price });
        updateKind(kind, { tiers: k.tiers });
    }
    function removeTier(kind: CardKind, idx: number) {
        const k = cloneKind(pricing.kinds[kind]);
        k.tiers.splice(idx, 1);
        updateKind(kind, { tiers: k.tiers });
    }

    async function handleSave() {
        setSaving(true); setError(null);
        try {
            const saved = await clientApi().updatePricing(pricing);
            setPricing(saved);
            toast("Pricing saved");
            router.refresh();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not save pricing");
        } finally {
            setSaving(false);
        }
    }

    const input = "w-full rounded border border-zinc-300 px-2 py-1 text-sm";

    return (
        <div className="mx-auto w-full max-w-5xl px-6 py-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Pricing</h1>
                    <p className="mt-1 text-sm text-zinc-500">
                        What you charge per card. Tiers price by <b>how many cards fit on one sheet</b> — e.g. flyers 2 per A4 at 15, 5 per A4 at 6. The tier with the largest cards-per-sheet at or below the actual layout applies; otherwise the base price.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/reports" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Reports</Link>
                    <button onClick={handleSave} disabled={saving} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
                        {saving ? "Saving…" : "Save pricing"}
                    </button>
                </div>
            </div>
            {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <div className="mb-6 grid gap-4 sm:grid-cols-3">
                <label className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
                    <span className="mb-1 block text-xs font-medium text-zinc-500">Currency</span>
                    <input value={pricing.currency} onChange={(e) => setPricing((p) => ({ ...p, currency: e.target.value.toUpperCase().slice(0, 8) }))} className={input} />
                </label>
                <label className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
                    <span className="mb-1 block text-xs font-medium text-zinc-500">Design fee per run</span>
                    <input type="number" min={0} value={pricing.design_fee} onChange={(e) => setPricing((p) => ({ ...p, design_fee: Math.max(0, Number(e.target.value) || 0) }))} className={input} />
                    <span className="mt-1 block text-[11px] text-zinc-400">0 = design is free, you only charge per card</span>
                </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                {KIND_LIST.map((kd) => {
                    const k = cloneKind(pricing.kinds[kd.kind]);
                    const examples = [1, 2, 4, 5, 8, 10].map((n) => ({ n, p: pricePerCard(pricing, kd.kind, n) }));
                    return (
                        <div key={kd.kind} className="rounded-xl border border-zinc-200 bg-white p-4">
                            <h2 className="mb-3 font-semibold">{kd.emoji} {kd.plural}</h2>
                            <div className="mb-3 grid grid-cols-2 gap-3">
                                <label className="text-xs text-zinc-600">
                                    Base price per card ({cur})
                                    <input type="number" min={0} step={0.5} value={k.unit_price} onChange={(e) => updateKind(kd.kind, { unit_price: Math.max(0, Number(e.target.value) || 0) })} className={`mt-1 ${input}`} />
                                </label>
                                <label className="text-xs text-zinc-600">
                                    Minimum cards charged
                                    <input type="number" min={1} value={k.min_quantity} onChange={(e) => updateKind(kd.kind, { min_quantity: Math.max(1, Number(e.target.value) || 1) })} className={`mt-1 ${input}`} />
                                </label>
                            </div>
                            <p className="mb-1 text-xs font-medium text-zinc-500">Tiers by cards per sheet</p>
                            {k.tiers.length === 0 && <p className="mb-2 text-xs text-zinc-400">No tiers — the base price always applies.</p>}
                            <div className="space-y-1.5">
                                {k.tiers.map((t, i) => (
                                    <div key={i} className="flex items-center gap-2 text-xs">
                                        <input type="number" min={1} value={t.per_sheet} onChange={(e) => updateTier(kd.kind, i, { per_sheet: Math.max(1, Number(e.target.value) || 1) })} className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm" />
                                        <span className="text-zinc-500">per sheet →</span>
                                        <input type="number" min={0} step={0.5} value={t.price} onChange={(e) => updateTier(kd.kind, i, { price: Math.max(0, Number(e.target.value) || 0) })} className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm" />
                                        <span className="text-zinc-500">{cur} each</span>
                                        <button onClick={() => removeTier(kd.kind, i)} className="ml-auto text-zinc-400 hover:text-red-500">&times;</button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => addTier(kd.kind)} className="mt-2 text-xs text-sky-600 hover:underline">+ Add tier</button>
                            <p className="mt-3 text-[11px] text-zinc-400">
                                Examples: {examples.map((e) => `${e.n}/sheet = ${money(e.p, cur)}`).join(" · ")} · min charge {money(k.min_quantity * pricePerCard(pricing, kd.kind, 10), cur)}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

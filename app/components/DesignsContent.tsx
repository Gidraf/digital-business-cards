"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi } from "@/lib/api";
import { DESIGN_KINDS, getKind } from "@/lib/card-kinds";
import { designCardData } from "@/lib/card-data";
import type { CardTemplate, Design } from "@/lib/types";
import CardPreviewRenderer from "./designer/CardPreviewRenderer";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./ToastProvider";

interface DesignsContentProps {
    designs: Design[];
    templates: CardTemplate[];
    initialKind?: string;
}

export default function DesignsContent({ designs, templates, initialKind }: DesignsContentProps) {
    const router = useRouter();
    const { toast } = useToast();
    const [kind, setKind] = useState<string>(initialKind && DESIGN_KINDS.some((k) => k.kind === initialKind) ? initialKind : "all");
    const [toDelete, setToDelete] = useState<Design | null>(null);

    const visible = kind === "all" ? designs : designs.filter((d) => d.kind === kind);
    const counts = new Map<string, number>();
    for (const d of designs) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);

    async function handleDelete() {
        if (!toDelete) return;
        try {
            await clientApi().deleteDesign(toDelete.id);
            toast("Design deleted");
            router.refresh();
        } catch {
            toast("Could not delete design", "error");
        }
        setToDelete(null);
    }

    return (
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Designs</h1>
                    <p className="mt-1 text-sm text-zinc-500">Event invitations, harambee cards, birthday & baby-shower cards, wedding cards and flyers — filled in and ready to print.</p>
                </div>
                <Link
                    href={`/designs/new${kind !== "all" ? `?kind=${kind}` : ""}`}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                >
                    + New design
                </Link>
            </div>

            <div className="mb-8 flex flex-wrap gap-2">
                <button onClick={() => setKind("all")} className={`rounded-full px-3 py-1.5 text-sm ${kind === "all" ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white hover:border-zinc-400"}`}>
                    All ({designs.length})
                </button>
                {DESIGN_KINDS.map((k) => (
                    <button key={k.kind} onClick={() => setKind(k.kind)} className={`rounded-full px-3 py-1.5 text-sm ${kind === k.kind ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white hover:border-zinc-400"}`}>
                        {k.emoji} {k.plural} ({counts.get(k.kind) ?? 0})
                    </button>
                ))}
            </div>

            {visible.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center">
                    <p className="font-medium text-zinc-700">No designs yet</p>
                    <p className="mt-1 text-sm text-zinc-500">Pick a card type to get started:</p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                        {DESIGN_KINDS.map((k) => (
                            <Link key={k.kind} href={`/designs/new?kind=${k.kind}`} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:border-zinc-400">
                                {k.emoji} {k.label}
                            </Link>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visible.map((d) => {
                        const template = templates.find((tp) => tp.id === d.template_id);
                        const kd = getKind(d.kind);
                        const scale = template ? Math.min(220 / template.config.width, 160 / template.config.height, 0.6) : 1;
                        return (
                            <div key={d.id} className="rounded-xl border border-zinc-200 bg-white p-4">
                                <Link href={`/designs/${d.id}`} className="mb-3 flex h-[176px] items-center justify-center rounded-lg bg-zinc-50 p-2">
                                    {template ? (
                                        <CardPreviewRenderer config={template.config} data={designCardData(d)} scale={scale} />
                                    ) : (
                                        <span className="text-sm text-zinc-400">No template</span>
                                    )}
                                </Link>
                                <p className="truncate font-semibold text-zinc-900">{d.name}</p>
                                <p className="text-sm text-zinc-500">{kd.emoji} {kd.label}{template ? ` · ${template.name}` : ""}</p>
                                <div className="mt-3 flex items-center gap-2">
                                    <Link href={`/designs/${d.id}`} className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700">Edit</Link>
                                    <Link href={`/print/new?design=${d.id}`} className="rounded-lg bg-[#FF6B35] px-3 py-2 text-sm font-medium text-white hover:bg-[#e55a2a]">🖨️ Print</Link>
                                    <button onClick={() => setToDelete(d)} className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600">Delete</button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {toDelete && (
                <ConfirmModal
                    title="Delete design"
                    message={`Delete "${toDelete.name}"? This cannot be undone.`}
                    confirmLabel="Delete"
                    destructive
                    onConfirm={handleDelete}
                    onCancel={() => setToDelete(null)}
                />
            )}
        </div>
    );
}

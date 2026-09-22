"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "./I18nProvider";
import UseTemplateButton from "./UseTemplateButton";
import DeleteTemplateButton from "./DeleteTemplateButton";
import DuplicateTemplateButton from "./DuplicateTemplateButton";
import TemplateCard from "./TemplateCard";
import { KIND_LIST, getKind } from "@/lib/card-kinds";
import type { CardTemplate } from "@/lib/types";

interface TemplatesContentProps {
    templates: CardTemplate[];
    initialKind?: string;
}

export default function TemplatesContent({ templates, initialKind }: TemplatesContentProps) {
    const { t } = useTranslation();
    const [kind, setKind] = useState<string>(initialKind && KIND_LIST.some((k) => k.kind === initialKind) ? initialKind : "all");

    const visible = kind === "all" ? templates : templates.filter((tp) => tp.kind === kind);
    const mine = visible.filter((tp) => !tp.is_builtin);
    const builtin = visible.filter((tp) => tp.is_builtin);
    const counts = new Map<string, number>();
    for (const tp of templates) counts.set(tp.kind, (counts.get(tp.kind) ?? 0) + 1);

    return (
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{t.templates_title}</h1>
                    <p className="mt-1 text-sm text-zinc-500">{t.templates_subtitle}</p>
                </div>
                <Link
                    href={`/templates/new${kind !== "all" ? `?kind=${kind}` : ""}`}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
                >
                    {t.templates_new}
                </Link>
            </div>

            <div className="mb-8 flex flex-wrap gap-2">
                <button onClick={() => setKind("all")} className={`rounded-full px-3 py-1.5 text-sm ${kind === "all" ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white hover:border-zinc-400"}`}>
                    All ({templates.length})
                </button>
                {KIND_LIST.map((k) => (
                    <button key={k.kind} onClick={() => setKind(k.kind)} className={`rounded-full px-3 py-1.5 text-sm ${kind === k.kind ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white hover:border-zinc-400"}`}>
                        {k.emoji} {k.plural} ({counts.get(k.kind) ?? 0})
                    </button>
                ))}
            </div>

            <div className="mb-12">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">{t.templates_your}</h2>
                {mine.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-10 text-center text-sm text-zinc-500">
                        No templates of your own yet — start from a built-in design below, or create one from scratch.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {mine.map((template) => (
                            <TemplateCard
                                key={template.id}
                                name={template.name}
                                config={template.config}
                                kind={template.kind}
                                hasBack={template.has_back}
                                subtitle={`${getKind(template.kind).label} · ${template.width_mm} × ${template.height_mm} mm`}
                                action={
                                    <div className="flex items-center gap-2">
                                        <Link href={`/templates/${template.id}/edit`} className="flex-1 rounded-lg bg-zinc-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-zinc-700">
                                            {t.companies_edit}
                                        </Link>
                                        <DuplicateTemplateButton templateId={template.id} templateName={template.name} />
                                        <DeleteTemplateButton templateId={template.id} templateName={template.name} />
                                    </div>
                                }
                            />
                        ))}
                    </div>
                )}
            </div>

            {builtin.length > 0 && (
                <div>
                    <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">{t.templates_starter}</h2>
                    <p className="mb-4 text-sm text-zinc-500">{t.templates_starter_sub}</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {builtin.map((template) => (
                            <TemplateCard
                                key={template.id}
                                name={template.name}
                                config={template.config}
                                kind={template.kind}
                                hasBack={template.has_back}
                                badge="Built-in"
                                subtitle={`${getKind(template.kind).label} · ${template.width_mm} × ${template.height_mm} mm`}
                                action={<UseTemplateButton templateId={template.id} name={template.name} />}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

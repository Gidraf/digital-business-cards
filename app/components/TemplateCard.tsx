"use client";

import CardPreviewRenderer from "./designer/CardPreviewRenderer";
import type { TemplateConfig, CardData } from "@/lib/types";
import { sampleCardData } from "@/lib/card-data";

interface TemplateCardProps {
    name: string;
    config: TemplateConfig;
    kind?: string;
    previewData?: CardData;
    badge?: string;
    subtitle?: string;
    hasBack?: boolean;
    onClick?: () => void;
    action?: React.ReactNode;
    selected?: boolean;
}

export default function TemplateCard({ name, config, kind = "business_card", previewData, badge, subtitle, hasBack, onClick, action, selected }: TemplateCardProps) {
    // fit into a ~220×160 box
    const scale = Math.min(220 / config.width, 160 / config.height, 0.6);

    const content = (
        <div className={`rounded-xl border bg-white p-4 transition ${selected ? "border-[#FF6B35] ring-2 ring-[#FF6B35]/20" : "border-zinc-200"} ${onClick ? "cursor-pointer hover:border-zinc-400 hover:shadow-md" : ""}`}>
            <div className="mb-3 flex h-[176px] items-center justify-center rounded-lg bg-zinc-50 p-2">
                <CardPreviewRenderer
                    config={config}
                    data={previewData ?? sampleCardData(kind)}
                    scale={scale}
                />
            </div>
            <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-zinc-900">{name}</p>
                {badge && (
                    <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-600">{badge}</span>
                )}
                {hasBack && (
                    <span className="shrink-0 rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">2-sided</span>
                )}
            </div>
            <p className="text-sm text-zinc-500">
                {subtitle ?? `${config.width} × ${config.height}${config.elements ? ` · ${config.elements.length} elements` : ""}`}
            </p>
            {action && <div className="mt-3">{action}</div>}
        </div>
    );

    if (onClick) {
        return <button onClick={onClick} className="w-full text-left">{content}</button>;
    }
    return content;
}

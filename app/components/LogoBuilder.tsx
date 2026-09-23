"use client";

import { useMemo, useState } from "react";
import {
    LOGO_COLORS, LOGO_ICONS, generateLogos, generateOrnaments, initialsFrom, svgToFile,
    type InkStyle, type LogoVariant,
} from "@/lib/logo-builder";

interface LogoBuilderProps {
    /** pre-fill from the company / celebrant / event name */
    defaultName?: string;
    /** "logo" = marks & wordmarks, "ornament" = decorative art for empty photo slots */
    mode?: "logo" | "ornament";
    title?: string;
    onPick: (file: File, previewSvg: string) => void;
    onClose: () => void;
}

export default function LogoBuilder({ defaultName = "", mode = "logo", title, onPick, onClose }: LogoBuilderProps) {
    const [tab, setTab] = useState<"logo" | "ornament">(mode);
    const [name, setName] = useState(defaultName);
    const [tagline, setTagline] = useState("");
    const [customInitials, setCustomInitials] = useState("");
    const [icon, setIcon] = useState("");
    const [color, setColor] = useState(LOGO_COLORS[0]);
    const [ink, setInk] = useState<InkStyle>("line");
    const [serif, setSerif] = useState(false);
    const [picked, setPicked] = useState<string | null>(null);

    const autoInitials = initialsFrom(name || defaultName || "Your Business");

    const variants: LogoVariant[] = useMemo(() => {
        if (tab === "ornament") return generateOrnaments({ color, ink });
        return generateLogos({ name, tagline, initials: customInitials || undefined, icon, color, ink, serif });
    }, [tab, name, tagline, customInitials, icon, color, ink, serif]);

    function choose(v: LogoVariant) {
        setPicked(v.id);
        onPick(svgToFile(v.svg, `${name || "artwork"}-${v.id}`), v.svg);
    }

    const field = "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500";

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3">
                    <div>
                        <h2 className="text-lg font-semibold">{title ?? "✨ Smart logo builder"}</h2>
                        <p className="text-xs text-zinc-500">No logo? Build one from the name. Vector, prints sharp, and the line styles use almost no ink.</p>
                    </div>
                    <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700">&times;</button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                    {/* controls */}
                    <div className="w-full shrink-0 space-y-3 overflow-y-auto border-b border-zinc-200 p-4 md:w-72 md:border-b-0 md:border-r">
                        <div className="flex gap-1 rounded-lg border border-zinc-200 p-0.5">
                            <button onClick={() => setTab("logo")} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${tab === "logo" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>Logo</button>
                            <button onClick={() => setTab("ornament")} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${tab === "ornament" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>Ornament</button>
                        </div>

                        {tab === "logo" && (
                            <>
                                <label className="block text-xs font-medium text-zinc-600">
                                    Business / person name
                                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Wanjiru Salon" className={`mt-1 ${field}`} />
                                </label>
                                <label className="block text-xs font-medium text-zinc-600">
                                    Tagline <span className="font-normal text-zinc-400">(optional)</span>
                                    <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Hair & beauty" className={`mt-1 ${field}`} />
                                </label>
                                <label className="block text-xs font-medium text-zinc-600">
                                    Initials <span className="font-normal text-zinc-400">(auto: {autoInitials})</span>
                                    <input value={customInitials} onChange={(e) => setCustomInitials(e.target.value.slice(0, 3).toUpperCase())} placeholder={autoInitials} className={`mt-1 ${field}`} />
                                </label>
                                <label className="block text-xs font-medium text-zinc-600">
                                    Trade / symbol
                                    <select value={icon} onChange={(e) => setIcon(e.target.value)} className={`mt-1 ${field}`}>
                                        <option value="">Letters only</option>
                                        {LOGO_ICONS.map((i) => <option key={i.key} value={i.key}>{i.label}</option>)}
                                    </select>
                                </label>
                            </>
                        )}

                        <div>
                            <p className="mb-1 text-xs font-medium text-zinc-600">Colour</p>
                            <div className="flex flex-wrap gap-1.5">
                                {LOGO_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        onClick={() => setColor(c)}
                                        aria-label={c}
                                        className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-zinc-900" : "border-transparent"}`}
                                        style={{ backgroundColor: c }}
                                    />
                                ))}
                                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-7 cursor-pointer rounded-full border border-zinc-300 p-0" title="Custom colour" />
                            </div>
                        </div>

                        <div>
                            <p className="mb-1 text-xs font-medium text-zinc-600">Style</p>
                            <div className="flex gap-1 rounded-lg border border-zinc-200 p-0.5">
                                <button onClick={() => setInk("line")} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${ink === "line" ? "bg-emerald-600 text-white" : "hover:bg-zinc-100"}`}>Line (saves ink)</button>
                                <button onClick={() => setInk("solid")} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${ink === "solid" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>Solid</button>
                            </div>
                        </div>

                        {tab === "logo" && (
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={serif} onChange={(e) => setSerif(e.target.checked)} />
                                Serif letters (weddings, invitations)
                            </label>
                        )}

                        <p className="rounded-lg bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
                            Saved as SVG, so it stays crisp at any size. Click a design to use it.
                        </p>
                    </div>

                    {/* variants */}
                    <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 p-4">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            {variants.map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => choose(v)}
                                    className={`group flex flex-col items-center gap-2 rounded-xl border bg-white p-3 transition hover:border-zinc-400 hover:shadow-md ${picked === v.id ? "border-[#FF6B35] ring-2 ring-[#FF6B35]/20" : "border-zinc-200"}`}
                                >
                                    <div
                                        className="flex h-28 w-full items-center justify-center overflow-hidden [&>svg]:max-h-full [&>svg]:max-w-full"
                                        // generated by lib/logo-builder from escaped input
                                        dangerouslySetInnerHTML={{ __html: v.svg }}
                                    />
                                    <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                        {v.label}
                                        {v.heavy && <span className="rounded bg-amber-50 px-1 text-[10px] text-amber-700" title="Large solid fill — uses more ink">ink</span>}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

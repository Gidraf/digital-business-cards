"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi, ApiError } from "@/lib/api";
import { getKind } from "@/lib/card-kinds";
import type { CardData, CardKind, CardTemplate, Design, TemplateConfig } from "@/lib/types";
import CardPreviewRenderer from "./designer/CardPreviewRenderer";
import TemplateDesigner from "./TemplateDesigner";
import ImageUpload from "./ImageUpload";
import { useToast } from "./ToastProvider";

interface DesignEditorProps {
    kind: CardKind;
    templates: CardTemplate[];
    design?: Design;
    initialTemplateId?: string;
}

export default function DesignEditor({ kind, templates, design, initialTemplateId }: DesignEditorProps) {
    const router = useRouter();
    const { toast } = useToast();
    const kd = getKind(kind);
    const [name, setName] = useState(design?.name ?? "");
    const [templateId, setTemplateId] = useState<string>(design?.template_id ?? initialTemplateId ?? templates[0]?.id ?? "");
    const [data, setData] = useState<Record<string, string>>(() => {
        if (design) return { ...design.data };
        // start from the sample so the preview is meaningful, then let the user overwrite
        const init: Record<string, string> = {};
        for (const f of kd.fields) init[f.key] = "";
        return init;
    });
    const [imageFiles, setImageFiles] = useState<Partial<Record<"logo" | "photo", File | null>>>({});
    const [imagePreviews, setImagePreviews] = useState<Partial<Record<"logo" | "photo", string | null>>>({
        logo: design?.image_urls?.logo ?? null,
        photo: design?.image_urls?.photo ?? null,
    });
    const [side, setSide] = useState<"front" | "back">("front");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [customizing, setCustomizing] = useState(false);
    const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
    const [localTemplates, setLocalTemplates] = useState<CardTemplate[]>(templates);
    const [showAllTemplates, setShowAllTemplates] = useState(false);

    const template = localTemplates.find((t) => t.id === templateId) ?? null;

    // Resolve asset URLs used by the chosen template
    useEffect(() => {
        const ids = new Set<string>();
        for (const cfg of [template?.config, template?.back_config]) {
            for (const el of cfg?.elements ?? []) {
                if (el.imageSource?.startsWith("asset:") && !el.imageSource.startsWith("asset:data:")) ids.add(el.imageSource.slice(6));
            }
        }
        const missing = [...ids].filter((id) => !assetUrls[id]);
        if (missing.length === 0) return;
        let cancelled = false;
        clientApi().resolveAssets(missing).then((urls) => {
            if (cancelled) return;
            setAssetUrls((prev) => {
                const next = { ...prev };
                for (const [k, v] of Object.entries(urls)) if (v) next[k] = v;
                return next;
            });
        }).catch(() => undefined);
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [template?.id]);

    // object URLs for freshly picked images
    useEffect(() => {
        const urls: string[] = [];
        const next: Partial<Record<"logo" | "photo", string | null>> = {};
        for (const key of ["logo", "photo"] as const) {
            const f = imageFiles[key];
            if (f) { const u = URL.createObjectURL(f); urls.push(u); next[key] = u; }
        }
        if (urls.length) setImagePreviews((prev) => ({ ...prev, ...next }));
        return () => { urls.forEach((u) => URL.revokeObjectURL(u)); };
    }, [imageFiles]);

    const previewData: CardData = useMemo(() => {
        const base: CardData = { logoUrl: imagePreviews.logo ?? null, photoUrl: imagePreviews.photo ?? null, custom_fields: {} };
        for (const f of kd.fields) {
            const v = data[f.key];
            // empty fields show the sample text, faded, so the layout stays readable while typing
            base[f.key] = v && v.length > 0 ? v : (typeof kd.sample[f.key] === "string" ? (kd.sample[f.key] as string) : "");
        }
        return base;
    }, [data, imagePreviews, kd]);

    const filled = kd.fields.filter((f) => (data[f.key] ?? "").trim().length > 0).length;

    const groups = useMemo(() => {
        const m = new Map<string, typeof kd.fields>();
        for (const f of kd.fields) {
            const g = f.group ?? "Details";
            if (!m.has(g)) m.set(g, []);
            m.get(g)!.push(f);
        }
        return [...m.entries()];
    }, [kd]);

    async function persist(): Promise<Design | null> {
        if (!name.trim()) { setError("Give this design a name"); return null; }
        if (!templateId) { setError("Choose a template"); return null; }
        setError(null);
        setSaving(true);
        const api = clientApi();
        try {
            const body = { name: name.trim(), kind, template_id: templateId, data };
            let saved = design ? await api.updateDesign(design.id, body) : await api.createDesign(body);
            for (const key of ["logo", "photo"] as const) {
                const f = imageFiles[key];
                if (f) saved = await api.uploadDesignImage(saved.id, key, f, f.name);
            }
            setImageFiles({});
            return saved;
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not save design");
            return null;
        } finally {
            setSaving(false);
        }
    }

    async function handleSave() {
        const saved = await persist();
        if (!saved) return;
        toast("Design saved");
        if (!design) router.replace(`/designs/${saved.id}`);
        else router.refresh();
    }

    async function handlePrint() {
        const saved = await persist();
        if (!saved) return;
        router.push(`/print/new?design=${saved.id}`);
    }

    async function handleRemoveImage(key: "logo" | "photo") {
        setImageFiles((p) => ({ ...p, [key]: null }));
        setImagePreviews((p) => ({ ...p, [key]: null }));
        if (design?.image_keys?.[key]) {
            try { await clientApi().deleteDesignImage(design.id, key); } catch { /* ignore */ }
        }
    }

    /** "Customize" = copy the template into the partner's library with the edits, and switch to it. */
    async function handleCustomized(config: TemplateConfig, backConfig: TemplateConfig | null) {
        if (!template) return;
        const api = clientApi();
        try {
            let target = template;
            if (template.is_builtin) {
                target = await api.duplicateTemplate(template.id, `${template.name} (${name || "custom"})`);
            }
            const updated = await api.updateTemplate(target.id, { config, back_config: backConfig });
            setLocalTemplates((prev) => {
                const without = prev.filter((t) => t.id !== updated.id);
                return [updated, ...without];
            });
            setTemplateId(updated.id);
            toast(template.is_builtin ? "Saved as your own template" : "Template updated");
        } catch (err) {
            toast(err instanceof ApiError ? err.message : "Could not save template", "error");
        } finally {
            setCustomizing(false);
        }
    }

    const previewScale = template ? Math.min(360 / template.config.width, 480 / template.config.height, 1) : 1;
    const shownTemplates = showAllTemplates ? localTemplates : localTemplates.slice(0, 6);

    if (customizing && template) {
        return (
            <TemplateDesigner
                overlay
                overlayKind={kind}
                overlayConfig={template.config}
                overlayBackConfig={template.back_config}
                overlayPreviewData={previewData}
                onOverlaySave={handleCustomized}
                onOverlayCancel={() => setCustomizing(false)}
            />
        );
    }

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
            <div className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
                <Link href="/designs" className="hover:text-zinc-800">Designs</Link>
                <span>/</span>
                <span className="text-zinc-900">{design ? design.name : `New ${kd.label.toLowerCase()}`}</span>
            </div>

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <span className="text-2xl">{kd.emoji}</span>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={`${kd.label} name (e.g. ${kd.sample[kd.fields[0].key] ?? "My card"})`}
                    className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium outline-none focus:border-zinc-500"
                />
                <div className="ml-auto flex items-center gap-2">
                    {design && (
                        <Link href="/designs" className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800">Back</Link>
                    )}
                    <button onClick={handleSave} disabled={saving} className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
                        {saving ? "Saving…" : "Save"}
                    </button>
                    <button onClick={handlePrint} disabled={saving} className="rounded-lg bg-[#FF6B35] px-5 py-2 text-sm font-medium text-white hover:bg-[#e55a2a] disabled:opacity-50">
                        🖨️ Save & print
                    </button>
                </div>
            </div>
            {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

            <div className="grid gap-8 lg:grid-cols-[300px_1fr_380px]">
                {/* Template picker */}
                <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">1 · Template</h2>
                    {localTemplates.length === 0 ? (
                        <p className="text-sm text-zinc-500">No templates for this card type yet. <Link href={`/templates/new?kind=${kind}`} className="text-sky-600 underline">Create one</Link>.</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
                            {shownTemplates.map((tp) => {
                                const s = Math.min(120 / tp.config.width, 90 / tp.config.height);
                                return (
                                    <button
                                        key={tp.id}
                                        onClick={() => setTemplateId(tp.id)}
                                        className={`flex items-center gap-3 rounded-lg border p-2 text-left ${templateId === tp.id ? "border-[#FF6B35] bg-orange-50" : "border-zinc-200 bg-white hover:border-zinc-400"}`}
                                    >
                                        <div className="flex h-[90px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-50">
                                            <CardPreviewRenderer config={tp.config} data={previewData} assetUrls={assetUrls} scale={s} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-medium">{tp.name}</p>
                                            <p className="text-xs text-zinc-500">{tp.width_mm}×{tp.height_mm} mm{tp.has_back ? " · 2-sided" : ""}{tp.is_builtin ? " · built-in" : ""}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                    {localTemplates.length > 6 && (
                        <button onClick={() => setShowAllTemplates((v) => !v)} className="mt-2 text-xs text-sky-600 hover:underline">
                            {showAllTemplates ? "Show fewer" : `Show all ${localTemplates.length}`}
                        </button>
                    )}
                    {template && (
                        <button onClick={() => setCustomizing(true)} className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                            ✏️ Customize this design
                        </button>
                    )}
                </div>

                {/* Fields */}
                <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">2 · Details <span className="font-normal normal-case text-zinc-400">({filled}/{kd.fields.length} filled)</span></h2>
                    <div className="space-y-5">
                        {kd.images.length > 0 && (
                            <div className="rounded-xl border border-zinc-200 bg-white p-4">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Images</p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {kd.images.map((img) => (
                                        <div key={img.key}>
                                            <ImageUpload
                                                label={img.label}
                                                onImageReady={(file) => setImageFiles((p) => ({ ...p, [img.key]: file }))}
                                                currentImageUrl={imagePreviews[img.key] ?? null}
                                                allowSkipCrop
                                            />
                                            {imagePreviews[img.key] && (
                                                <button onClick={() => handleRemoveImage(img.key)} className="mt-1 text-xs text-red-500 hover:underline">Remove</button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {groups.map(([group, fields]) => (
                            <div key={group} className="rounded-xl border border-zinc-200 bg-white p-4">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">{group}</p>
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {fields.map((f) => (
                                        <div key={f.key} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                                            <label className="mb-1 block text-xs font-medium text-zinc-600">{f.label}</label>
                                            {f.type === "textarea" ? (
                                                <textarea
                                                    value={data[f.key] ?? ""}
                                                    onChange={(e) => setData((d) => ({ ...d, [f.key]: e.target.value }))}
                                                    placeholder={f.placeholder}
                                                    rows={3}
                                                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                                                />
                                            ) : (
                                                <input
                                                    type={f.type === "email" ? "email" : f.type === "url" ? "url" : f.type === "phone" ? "tel" : "text"}
                                                    value={data[f.key] ?? ""}
                                                    onChange={(e) => setData((d) => ({ ...d, [f.key]: e.target.value }))}
                                                    placeholder={f.placeholder}
                                                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Preview */}
                <div>
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">3 · Preview</h2>
                        {template?.back_config && (
                            <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-0.5">
                                <button onClick={() => setSide("front")} className={`rounded-md px-3 py-1 text-xs font-medium ${side === "front" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>Front</button>
                                <button onClick={() => setSide("back")} className={`rounded-md px-3 py-1 text-xs font-medium ${side === "back" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>Back</button>
                            </div>
                        )}
                    </div>
                    <div className="sticky top-20 flex min-h-[300px] items-center justify-center rounded-xl bg-zinc-100 p-4" style={{ backgroundColor: template?.config.pageBackgroundColor ?? "#f4f4f5" }}>
                        {template ? (
                            <CardPreviewRenderer
                                config={side === "back" && template.back_config ? template.back_config : template.config}
                                data={previewData}
                                assetUrls={assetUrls}
                                scale={previewScale}
                            />
                        ) : (
                            <p className="text-sm text-zinc-500">Choose a template to preview</p>
                        )}
                    </div>
                    {template && (
                        <p className="mt-2 text-center text-xs text-zinc-400">
                            {template.width_mm} × {template.height_mm} mm · empty fields show sample text until filled
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

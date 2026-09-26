"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { clientApi, ApiError } from "@/lib/api";
import { getGoogleFontsUrl, getUsedFonts } from "@/lib/fonts";
import { DEFAULT_TEMPLATE_CONFIG, CARD_WIDTH, CARD_HEIGHT } from "@/lib/types";
import type { TemplateConfig, CardElement, CardData, CardKind, CardTemplate, Company, Person, Design } from "@/lib/types";
import { getKind, KIND_LIST, type SizePreset } from "@/lib/card-kinds";
import { personCardData, designCardData, sampleCardData } from "@/lib/card-data";
import { useTranslation } from "./I18nProvider";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./ToastProvider";
import ThemeMatcher from "./ThemeMatcher";
import LayersPanel from "./designer/LayersPanel";
import DesignerCanvas from "./designer/DesignerCanvas";
import PropertiesPanel from "./designer/PropertiesPanel";
import ElementsToolbar from "./designer/ElementsToolbar";

type Side = "front" | "back";

interface TemplateDesignerProps {
    /** existing template to edit */
    template?: CardTemplate;
    /** kind for a brand-new template */
    initialKind?: CardKind;
    // Overlay mode — renders fullscreen, calls onSave/onCancel instead of saving to the API
    overlay?: boolean;
    overlayPreviewData?: CardData;
    overlayKind?: CardKind;
    overlayConfig?: TemplateConfig;
    overlayBackConfig?: TemplateConfig | null;
    onOverlaySave?: (config: TemplateConfig, backConfig: TemplateConfig | null) => void;
    onOverlayCancel?: () => void;
}

function blankBack(front: TemplateConfig): TemplateConfig {
    return { width: front.width, height: front.height, backgroundColor: front.backgroundColor, pageBackgroundColor: front.pageBackgroundColor, elements: [] };
}

export default function TemplateDesigner({
    template,
    initialKind = "business_card",
    overlay = false,
    overlayPreviewData,
    overlayKind,
    overlayConfig,
    overlayBackConfig,
    onOverlaySave,
    onOverlayCancel,
}: TemplateDesignerProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const { toast } = useToast();
    const templateId = template?.id;
    const draftKey = `cardgen_draft_${templateId ?? `new_${initialKind}`}`;

    const [name, setName] = useState(template?.name ?? "");
    const [kind, setKind] = useState<CardKind>(overlay ? (overlayKind ?? initialKind) : (template?.kind ?? initialKind));
    const kindDef = getKind(kind);
    const [sizeMm, setSizeMm] = useState<{ width_mm: number; height_mm: number }>(() => {
        if (template) return { width_mm: template.width_mm, height_mm: template.height_mm };
        const preset = getKind(overlay ? overlayKind ?? initialKind : initialKind).sizes[0];
        return { width_mm: preset.width_mm, height_mm: preset.height_mm };
    });
    const [side, setSide] = useState<Side>("front");
    const [config, setConfigInternal] = useState<TemplateConfig>(() => {
        if (overlay && overlayConfig) return overlayConfig;
        if (template) return template.config;
        const preset = getKind(initialKind).sizes[0];
        return { ...DEFAULT_TEMPLATE_CONFIG, width: preset.width, height: preset.height };
    });
    const [backConfig, setBackConfigInternal] = useState<TemplateConfig | null>(() => {
        if (overlay) return overlayBackConfig ?? null;
        return template?.back_config ?? null;
    });
    const [draftRestored, setDraftRestored] = useState(false);
    const [ready, setReady] = useState(false);
    const [saving, setSaving] = useState(false);
    const skipAutoSave = useRef(false);

    // Undo/redo history (both sides)
    type Snapshot = { config: TemplateConfig; backConfig: TemplateConfig | null };
    const undoStack = useRef<Snapshot[]>([]);
    const redoStack = useRef<Snapshot[]>([]);
    const latest = useRef<Snapshot>({ config, backConfig });
    latest.current = { config, backConfig };

    function pushHistory() {
        undoStack.current.push({ config: latest.current.config, backConfig: latest.current.backConfig });
        if (undoStack.current.length > 50) undoStack.current.shift();
        redoStack.current = [];
    }

    // The side currently being edited
    const activeConfig: TemplateConfig = side === "back" ? (backConfig ?? blankBack(config)) : config;

    function setActive(newConfig: TemplateConfig | ((prev: TemplateConfig) => TemplateConfig)) {
        pushHistory();
        if (side === "back") {
            setBackConfigInternal((prev) => {
                const base = prev ?? blankBack(latest.current.config);
                return typeof newConfig === "function" ? newConfig(base) : newConfig;
            });
        } else {
            setConfigInternal((prev) => (typeof newConfig === "function" ? newConfig(prev) : newConfig));
        }
    }

    /** Apply a change to BOTH sides (size, page colour). */
    function setBoth(patch: Partial<TemplateConfig>) {
        pushHistory();
        setConfigInternal((prev) => ({ ...prev, ...patch }));
        setBackConfigInternal((prev) => (prev ? { ...prev, ...patch } : prev));
    }

    function undo() {
        const prev = undoStack.current.pop();
        if (!prev) return;
        redoStack.current.push({ ...latest.current });
        setConfigInternal(prev.config);
        setBackConfigInternal(prev.backConfig);
    }

    function redo() {
        const next = redoStack.current.pop();
        if (!next) return;
        undoStack.current.push({ ...latest.current });
        setConfigInternal(next.config);
        setBackConfigInternal(next.backConfig);
    }

    // ── preview data ─────────────────────────────────────────────────────
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showGrid, setShowGrid] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
    const [companies, setCompanies] = useState<Company[]>([]);
    const [people, setPeople] = useState<Person[]>([]);
    const [designs, setDesigns] = useState<Design[]>([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState("");
    const [selectedPersonId, setSelectedPersonId] = useState("");
    const [selectedDesignId, setSelectedDesignId] = useState("");
    const [previewData, setPreviewData] = useState<CardData>(() => sampleCardData(overlay ? overlayKind ?? initialKind : template?.kind ?? initialKind));

    useEffect(() => {
        if (overlay && overlayPreviewData) setPreviewData(overlayPreviewData);
    }, [overlay, overlayPreviewData]);

    // Restore draft on mount
    useEffect(() => {
        if (overlay) { setReady(true); return; }
        const raw = localStorage.getItem(draftKey);
        if (raw) {
            try {
                const draft = JSON.parse(raw);
                if (draft.name) setName(draft.name);
                if (draft.config) setConfigInternal(draft.config);
                if ("backConfig" in draft) setBackConfigInternal(draft.backConfig ?? null);
                if (draft.kind) setKind(draft.kind);
                if (draft.sizeMm) setSizeMm(draft.sizeMm);
                setDraftRestored(true);
            } catch { /* ignore */ }
        }
        setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Load companies/people (business cards) or designs (other kinds) for live preview
    useEffect(() => {
        if (overlay) return;
        let cancelled = false;
        const api = clientApi();
        async function load() {
            try {
                if (kindDef.source === "person") {
                    const [cs, ps] = await Promise.all([api.listCompanies(), api.listPeople()]);
                    if (cancelled) return;
                    setCompanies(cs);
                    setPeople(ps);
                    if (cs.length > 0 && !selectedCompanyId) {
                        setSelectedCompanyId(cs[0].id);
                        const first = ps.find((p) => p.company_id === cs[0].id);
                        if (first) setSelectedPersonId(first.id);
                    }
                } else {
                    const ds = await api.listDesigns(kind);
                    if (cancelled) return;
                    setDesigns(ds);
                }
            } catch { /* preview falls back to sample data */ }
        }
        load();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [kind, overlay]);

    const filteredPeople = selectedCompanyId ? people.filter((p) => p.company_id === selectedCompanyId) : people;

    useEffect(() => {
        if (overlay) return;
        if (kindDef.source === "person") {
            const company = companies.find((c) => c.id === selectedCompanyId);
            const person = people.find((p) => p.id === selectedPersonId);
            if (person) {
                setPreviewData(personCardData(person, company));
            } else {
                setPreviewData({
                    ...sampleCardData("business_card"),
                    ...(company ? { company: company.name, website: company.website ?? "", address: company.address ?? "", logoUrl: company.logo_url } : {}),
                });
            }
        } else {
            const design = designs.find((d) => d.id === selectedDesignId);
            setPreviewData(design ? designCardData(design) : sampleCardData(kind));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedCompanyId, selectedPersonId, selectedDesignId, companies, people, designs, kind]);

    const selectedElement = activeConfig.elements.find((el) => el.id === selectedId) ?? null;

    // Auto-save draft
    useEffect(() => {
        if (overlay) return;
        if (skipAutoSave.current) { skipAutoSave.current = false; return; }
        localStorage.setItem(draftKey, JSON.stringify({ name, config, backConfig, kind, sizeMm }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [name, config, backConfig, kind, sizeMm, draftKey]);

    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

    function clearDraft() {
        localStorage.removeItem(draftKey);
        setDraftRestored(false);
    }

    function discardDraft() {
        skipAutoSave.current = true;
        clearDraft();
        setName(template?.name ?? "");
        setConfigInternal(template?.config ?? { ...DEFAULT_TEMPLATE_CONFIG, width: kindDef.sizes[0].width, height: kindDef.sizes[0].height });
        setBackConfigInternal(template?.back_config ?? null);
    }

    // Resolve asset URLs used on either side
    const usedAssetIds = useMemo(() => {
        const ids = new Set<string>();
        for (const cfg of [config, backConfig]) {
            for (const el of cfg?.elements ?? []) {
                if (el.imageSource?.startsWith("asset:") && !el.imageSource.startsWith("asset:data:")) ids.add(el.imageSource.slice(6));
            }
        }
        return [...ids];
    }, [config, backConfig]);

    useEffect(() => {
        const missing = usedAssetIds.filter((id) => !assetUrls[id]);
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
    }, [usedAssetIds.join(",")]);

    const registerAssetUrl = useCallback((id: string, url: string) => {
        setAssetUrls((prev) => (prev[id] === url ? prev : { ...prev, [id]: url }));
    }, []);

    // ── element ops ──────────────────────────────────────────────────────
    function createElementByType(type: string): CardElement {
        const id = crypto.randomUUID();
        const base = { id, x: 20, y: 20, zIndex: 1 };
        const firstField = kind === "business_card" ? "full_name_with_titles" : kindDef.fields[0]?.key ?? "custom";
        switch (type) {
            case "text": return { ...base, type: "text", width: 160, height: 30, boundField: firstField, fontSize: 14, fontFamily: "Inter, sans-serif", color: "#000", textAlign: "left" as const };
            case "photo": return { ...base, type: "image", width: 80, height: 80, imageSource: "photo", objectFit: "cover" as const, borderRadius: 999 };
            case "rectangle": return { ...base, type: "shape", x: 0, y: 0, width: activeConfig.width, height: 8, backgroundColor: "#3b82f6", shapeRadius: 0 };
            case "circle": return { ...base, type: "shape", width: 80, height: 80, backgroundColor: "#3b82f6", shapeRadius: 999 };
            case "line": return { ...base, type: "shape", width: 200, height: 2, backgroundColor: "#d4d4d8", shapeRadius: 1 };
            case "qrcode": return { ...base, type: "qrcode", x: activeConfig.width - 100, y: activeConfig.height - 100, width: 80, height: 80 };
            case "save-contact": return { ...base, type: "save-contact", width: 120, height: 28, fontSize: 12, color: "#3b82f6", fontFamily: "Inter, sans-serif", fontWeight: "500", customText: "Save Contact" };
            default: return { ...base, type: "text", width: 160, height: 30, boundField: "custom", customText: "New text", fontSize: 14, color: "#000" };
        }
    }

    function addElement(element: CardElement) {
        setActive((prev) => {
            const maxZ = prev.elements.reduce((max, el) => Math.max(max, el.zIndex), 0);
            return { ...prev, elements: [...prev.elements, { ...element, zIndex: maxZ + 1 }] };
        });
        setSelectedId(element.id);
    }

    function updateElement(id: string, updates: Partial<CardElement>) {
        setActive((prev) => ({ ...prev, elements: prev.elements.map((el) => (el.id === id ? { ...el, ...updates } : el)) }));
    }

    function deleteElement(id: string) {
        setActive((prev) => ({ ...prev, elements: prev.elements.filter((el) => el.id !== id) }));
        setSelectedId(null);
    }

    function moveLayer(id: string, direction: "up" | "down") {
        setActive((prev) => ({
            ...prev,
            elements: prev.elements.map((el) => (el.id !== id ? el : { ...el, zIndex: el.zIndex + (direction === "up" ? 1 : -1) })),
        }));
    }

    function duplicateElement(id: string) {
        const el = activeConfig.elements.find((e) => e.id === id);
        if (!el) return;
        const newEl = { ...el, id: crypto.randomUUID(), x: el.x + 10, y: el.y + 10 };
        setActive((prev) => ({ ...prev, elements: [...prev.elements, newEl] }));
        setSelectedId(newEl.id);
    }

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            const isTyping = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
            if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey && !isTyping) { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey)) && !isTyping) { e.preventDefault(); redo(); }
            if ((e.key === "Delete" || e.key === "Backspace") && !isTyping && selectedId) { e.preventDefault(); deleteElement(selectedId); }
            if (e.key === "Escape") setSelectedId(null);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedId, side]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    // ── size presets ─────────────────────────────────────────────────────
    function applyPreset(p: SizePreset) {
        setSizeMm({ width_mm: p.width_mm, height_mm: p.height_mm });
        setBoth({ width: p.width, height: p.height });
    }

    function toggleBack() {
        if (backConfig) {
            // remove back side
            pushHistory();
            setBackConfigInternal(null);
            setSide("front");
        } else {
            pushHistory();
            setBackConfigInternal(blankBack(config));
            setSide("back");
        }
        setSelectedId(null);
    }

    // ── save ─────────────────────────────────────────────────────────────
    async function handleSave() {
        if (overlay && onOverlaySave) {
            onOverlaySave(config, backConfig);
            return;
        }
        if (!name.trim()) {
            setError("Template name is required");
            return;
        }
        setError(null);
        setSaving(true);
        const api = clientApi();
        try {
            if (templateId) {
                await api.updateTemplate(templateId, { name, kind, config, back_config: backConfig, ...sizeMm });
                clearDraft();
                toast("Template saved successfully");
                router.refresh();
            } else {
                const created = await api.createTemplate({ name, kind, config, back_config: backConfig, ...sizeMm });
                clearDraft();
                router.push(`/templates/${created.id}/edit`);
            }
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not save template");
        } finally {
            setSaving(false);
        }
    }

    if (!ready) {
        return (
            <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="h-10 w-40 animate-pulse rounded-lg bg-zinc-200" />
                    <div className="h-10 w-36 animate-pulse rounded-lg bg-zinc-200" />
                </div>
                <div className="animate-pulse rounded-xl bg-zinc-100 p-8">
                    <div className="h-[260px] w-[450px] rounded-lg bg-zinc-200" />
                </div>
            </div>
        );
    }

    const fontsUrl = getGoogleFontsUrl(getUsedFonts([...config.elements, ...(backConfig?.elements ?? [])]));
    const activePreset = kindDef.sizes.find((p) => p.width_mm === sizeMm.width_mm && p.height_mm === sizeMm.height_mm);
    const customFieldDefs = companies.find((c) => c.id === selectedCompanyId)?.custom_field_definitions;

    const content = (
        <div className={overlay ? "flex flex-1 flex-col gap-4 overflow-auto p-4" : "flex flex-col gap-6"}>
            {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

            {/* Top bar */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                {!overlay && (
                    <>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t.designer_name}
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium outline-none focus:border-zinc-500 sm:w-auto"
                        />
                        <select
                            value={kind}
                            onChange={(e) => {
                                const k = e.target.value as CardKind;
                                setKind(k);
                                const p = getKind(k).sizes[0];
                                setSizeMm({ width_mm: p.width_mm, height_mm: p.height_mm });
                                setBoth({ width: p.width, height: p.height });
                                setSelectedPersonId(""); setSelectedDesignId("");
                            }}
                            disabled={!!templateId}
                            title={templateId ? "Card type can't change after creation" : "Card type"}
                            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:bg-zinc-50"
                        >
                            {KIND_LIST.map((k) => (
                                <option key={k.kind} value={k.kind}>{k.emoji} {k.label}</option>
                            ))}
                        </select>
                        {kindDef.source === "person" ? (
                            <>
                                <select
                                    value={selectedCompanyId}
                                    onChange={(e) => { setSelectedCompanyId(e.target.value); setSelectedPersonId(""); }}
                                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                                >
                                    <option value="">Company: Sample</option>
                                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <select
                                    value={selectedPersonId}
                                    onChange={(e) => setSelectedPersonId(e.target.value)}
                                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                                >
                                    <option value="">Person: Sample</option>
                                    {filteredPeople.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                                </select>
                            </>
                        ) : (
                            <select
                                value={selectedDesignId}
                                onChange={(e) => setSelectedDesignId(e.target.value)}
                                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
                            >
                                <option value="">Preview: Sample data</option>
                                {designs.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                        )}
                    </>
                )}
                {overlay && <h2 className="text-lg font-semibold">Customize Design</h2>}
                <div className="hidden flex-1 sm:block" />
                <div className="flex w-full items-center gap-2 sm:w-auto">
                    <div className="flex items-center gap-0.5 rounded-lg border border-zinc-200 bg-white">
                        <button onClick={undo} disabled={undoStack.current.length === 0} className="rounded-l-lg p-2 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 disabled:text-zinc-200 disabled:hover:bg-transparent" title="Undo (Ctrl+Z)">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.69 3L3 13" /></svg>
                        </button>
                        <div className="h-5 w-px bg-zinc-200" />
                        <button onClick={redo} disabled={redoStack.current.length === 0} className="rounded-r-lg p-2 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 disabled:text-zinc-200 disabled:hover:bg-transparent" title="Redo (Ctrl+Y)">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.69 3L21 13" /></svg>
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            if (overlay && onOverlayCancel) onOverlayCancel();
                            else if (draftRestored) setShowLeaveConfirm(true);
                            else router.back();
                        }}
                        className="rounded-lg px-4 py-2 text-sm text-zinc-500 hover:text-zinc-800"
                    >
                        {t.designer_cancel}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                    >
                        {saving ? "Saving…" : overlay ? "Apply Changes" : templateId ? t.designer_update : t.designer_save}
                    </button>
                </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {draftRestored && (
                <div className="flex items-center gap-3 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
                    <span>Unsaved draft restored.</span>
                    <button onClick={discardDraft} className="font-medium underline hover:no-underline">Discard draft</button>
                </div>
            )}

            {/* Size + sides */}
            <div className="flex flex-wrap items-center gap-4">
                <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-500">Print size</label>
                    <select
                        value={activePreset ? activePreset.label : "custom"}
                        onChange={(e) => {
                            const p = kindDef.sizes.find((x) => x.label === e.target.value);
                            if (p) applyPreset(p);
                        }}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500"
                    >
                        {kindDef.sizes.map((p) => <option key={p.label} value={p.label}>{p.label}</option>)}
                        {!activePreset && <option value="custom">Custom</option>}
                    </select>
                </div>
                <div className="flex items-end gap-2">
                    <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-500">W (mm)</label>
                        <input type="number" min={10} max={1000} value={sizeMm.width_mm} onChange={(e) => setSizeMm((s) => ({ ...s, width_mm: Number(e.target.value) || s.width_mm }))} className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-500">H (mm)</label>
                        <input type="number" min={10} max={1000} value={sizeMm.height_mm} onChange={(e) => setSizeMm((s) => ({ ...s, height_mm: Number(e.target.value) || s.height_mm }))} className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm" />
                    </div>
                    <div>
                        <label className="mb-1 block text-xs font-medium text-zinc-500">Canvas px</label>
                        <div className="flex items-center gap-1">
                            <input type="number" value={activeConfig.width} onChange={(e) => setBoth({ width: Number(e.target.value) || CARD_WIDTH })} className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm" />
                            <span className="text-xs text-zinc-400">×</span>
                            <input type="number" value={activeConfig.height} onChange={(e) => setBoth({ height: Number(e.target.value) || CARD_HEIGHT })} className="w-16 rounded border border-zinc-300 px-2 py-1 text-sm" />
                        </div>
                    </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <div className="flex gap-1 rounded-lg border border-zinc-200 bg-white p-0.5">
                        <button onClick={() => { setSide("front"); setSelectedId(null); }} className={`rounded-md px-3 py-1.5 text-xs font-medium ${side === "front" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>Front</button>
                        <button
                            onClick={() => { if (!backConfig) toggleBack(); else { setSide("back"); setSelectedId(null); } }}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium ${side === "back" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}
                        >
                            {backConfig ? "Back" : "+ Add back side"}
                        </button>
                    </div>
                    {backConfig && (
                        <button onClick={toggleBack} className="text-xs text-red-500 hover:underline">Remove back</button>
                    )}
                </div>
            </div>

            {/* Elements toolbar */}
            <ElementsToolbar onAddElement={addElement} companyId={selectedCompanyId || undefined} kind={kind} onAssetUrl={registerAssetUrl} />

            {/* Main area: canvas + properties */}
            <div className="flex flex-col gap-6 lg:flex-row">
                <div className="flex min-w-0 flex-col gap-3 overflow-x-auto">
                    <div className="flex items-center gap-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-500">{side === "back" ? "Back" : "Card"}</label>
                            <input type="color" value={activeConfig.backgroundColor} onChange={(e) => setActive((prev) => ({ ...prev, backgroundColor: e.target.value }))} className="h-8 w-14 cursor-pointer rounded border border-zinc-300" />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-zinc-500">Page</label>
                            <input type="color" value={activeConfig.pageBackgroundColor ?? "#f4f4f5"} onChange={(e) => setBoth({ pageBackgroundColor: e.target.value })} className="h-8 w-14 cursor-pointer rounded border border-zinc-300" />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
                            {t.designer_grid}
                        </label>
                        <span className="text-xs text-zinc-400">
                            {sizeMm.width_mm} × {sizeMm.height_mm} mm · {side === "back" ? "back side" : "front side"}
                        </span>
                        <div className="ml-auto">
                            <ThemeMatcher config={activeConfig} onApply={(next) => setActive(() => next)} />
                        </div>
                    </div>
                    <div className="rounded-xl p-8" style={{ backgroundColor: activeConfig.pageBackgroundColor ?? "#f4f4f5" }}>
                        <DesignerCanvas
                            width={activeConfig.width ?? CARD_WIDTH}
                            height={activeConfig.height ?? CARD_HEIGHT}
                            backgroundColor={activeConfig.backgroundColor}
                            elements={activeConfig.elements}
                            selectedId={selectedId}
                            sampleData={previewData}
                            assetUrls={assetUrls}
                            showGrid={showGrid}
                            onSelect={setSelectedId}
                            onUpdateElement={updateElement}
                        />
                    </div>
                </div>

                <div className="flex w-full shrink-0 flex-col lg:w-72" style={{ height: "80vh" }}>
                    <div className="flex-1 overflow-y-auto border-b border-zinc-200 pb-2">
                        <LayersPanel
                            elements={activeConfig.elements}
                            selectedId={selectedId}
                            onSelect={setSelectedId}
                            onReorder={(reordered) => setActive((prev) => ({ ...prev, elements: reordered }))}
                            onUpdate={updateElement}
                            onDelete={deleteElement}
                            onDuplicate={duplicateElement}
                            onAddElement={(type) => addElement(createElementByType(type))}
                        />
                    </div>
                    <div className="flex-1 overflow-y-auto pt-3">
                        {selectedElement ? (
                            <PropertiesPanel
                                element={selectedElement}
                                cardWidth={activeConfig.width}
                                cardHeight={activeConfig.height}
                                kind={kind}
                                companyId={selectedCompanyId || null}
                                customFieldDefs={customFieldDefs}
                                onAssetUrl={registerAssetUrl}
                                onUpdate={(updates) => updateElement(selectedElement.id, updates)}
                                onDelete={() => deleteElement(selectedElement.id)}
                                onDuplicate={() => duplicateElement(selectedElement.id)}
                                onMoveUp={() => moveLayer(selectedElement.id, "up")}
                                onMoveDown={() => moveLayer(selectedElement.id, "down")}
                            />
                        ) : (
                            <p className="text-sm text-zinc-400">Select an element to edit its properties.</p>
                        )}
                    </div>
                </div>
            </div>

            {showLeaveConfirm && (
                <ConfirmModal
                    title="Unsaved changes"
                    message="You have unsaved changes. Do you want to discard them?"
                    confirmLabel="Discard & leave"
                    destructive
                    onConfirm={() => { clearDraft(); router.back(); }}
                    onCancel={() => setShowLeaveConfirm(false)}
                />
            )}
        </div>
    );

    if (overlay) {
        return <div className="fixed inset-0 z-50 flex flex-col bg-white">{content}</div>;
    }
    return content;
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi, ApiError } from "@/lib/api";
import { getKind, DESIGN_KINDS } from "@/lib/card-kinds";
import { personCardData } from "@/lib/card-data";
import {
    DEFAULT_LAYOUT, PAPERS, buildSheetHtml, expandItems, inlineImageUrl, layoutSummary, paperSize,
    type CardInstance,
} from "@/lib/print-layout";
import type { CardKind, CardTemplate, Company, Design, PaperName, Person, PrintItem, PrintJob, PrintLayoutSettings, PrintMaterials } from "@/lib/types";
import CardPreviewRenderer from "../designer/CardPreviewRenderer";
import { useToast } from "../ToastProvider";

interface PrintStudioProps {
    job?: PrintJob;
    companies: Company[];
    people: Person[];
    designs: Design[];
    templates: CardTemplate[];
    seed?: { company?: string; person?: string; design?: string };
}

type ItemRow = PrintItem & { key: string };

function newKey() {
    return crypto.randomUUID();
}

export default function PrintStudio({ job, companies, people, designs, templates, seed }: PrintStudioProps) {
    const router = useRouter();
    const { toast } = useToast();

    const [jobId, setJobId] = useState<string | null>(job?.id ?? null);
    const [name, setName] = useState(job?.name ?? "");
    const [paper, setPaper] = useState<PaperName>(job?.paper ?? "A4");
    const [orientation, setOrientation] = useState<"portrait" | "landscape">(job?.orientation ?? "portrait");
    const [layout, setLayout] = useState<PrintLayoutSettings>({ ...DEFAULT_LAYOUT, ...(job?.layout ?? {}) });
    const [items, setItems] = useState<ItemRow[]>(() => {
        if (job) return job.items.map((it) => ({ ...it, key: newKey() }));
        const seeded: ItemRow[] = [];
        if (seed?.company) {
            for (const p of people.filter((x) => x.company_id === seed.company)) {
                seeded.push({ key: newKey(), source: "person", source_id: p.id, template_id: null, quantity: 10, include_back: true });
            }
        }
        if (seed?.person) seeded.push({ key: newKey(), source: "person", source_id: seed.person, template_id: null, quantity: 10, include_back: true });
        if (seed?.design) seeded.push({ key: newKey(), source: "design", source_id: seed.design, template_id: null, quantity: 10, include_back: true });
        return seeded;
    });
    const [pdfUrl, setPdfUrl] = useState<string | null>(job?.pdf_url ?? null);
    const [pageCount, setPageCount] = useState<number>(job?.page_count ?? 0);
    const [status, setStatus] = useState<PrintJob["status"]>(job?.status ?? "draft");

    // picker
    const [pickerTab, setPickerTab] = useState<"people" | "designs">(seed?.design ? "designs" : "people");
    const [pickerCompany, setPickerCompany] = useState<string>(seed?.company ?? companies[0]?.id ?? "");
    const [pickerKind, setPickerKind] = useState<string>("all");
    const [search, setSearch] = useState("");

    // preview pipeline
    const [materials, setMaterials] = useState<PrintMaterials | null>(null);
    const [cards, setCards] = useState<CardInstance[]>([]);
    const [skipped, setSkipped] = useState<string[]>([]);
    const [building, setBuilding] = useState(false);
    const [sheetHtml, setSheetHtml] = useState<string>("");
    const [busy, setBusy] = useState<null | "save" | "pdf" | "print">(null);
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(0.55);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const dirty = useRef(false);

    const plainItems: PrintItem[] = useMemo(() => items.map(({ key: _k, ...rest }) => rest), [items]); // eslint-disable-line @typescript-eslint/no-unused-vars
    const itemsSig = JSON.stringify(plainItems);

    // 1. materials for the current item list (debounced)
    useEffect(() => {
        if (plainItems.length === 0) { setMaterials(null); setCards([]); setSkipped([]); return; }
        let cancelled = false;
        const handle = setTimeout(async () => {
            try {
                const m = await clientApi().printMaterials(plainItems);
                if (!cancelled) setMaterials(m);
            } catch (err) {
                if (!cancelled) setError(err instanceof ApiError ? err.message : "Could not load cards");
            }
        }, 250);
        return () => { cancelled = true; clearTimeout(handle); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemsSig]);

    // 2. expand items → card instances (inlines images once per URL)
    useEffect(() => {
        if (!materials) return;
        let cancelled = false;
        setBuilding(true);
        expandItems(plainItems, materials, inlineImageUrl).then(({ cards: c, skipped: s }) => {
            if (cancelled) return;
            setCards(c);
            setSkipped(s);
            setBuilding(false);
        }).catch(() => { if (!cancelled) setBuilding(false); });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [materials]);

    // 3. sheet HTML
    const sheet = useMemo(() => {
        if (cards.length === 0) return null;
        return buildSheetHtml(cards, { paper, orientation, layout, title: name || "Print sheet", previewOutlines: true });
    }, [cards, paper, orientation, layout, name]);

    useEffect(() => {
        setSheetHtml(sheet?.html ?? "");
    }, [sheet]);

    const summary = useMemo(() => (cards.length ? layoutSummary(cards, { paper, orientation, layout }) : null), [cards, paper, orientation, layout]);
    const perOrientation = useMemo(() => ({
        portrait: cards.length ? layoutSummary(cards, { paper, orientation: "portrait", layout }).perPage : 0,
        landscape: cards.length ? layoutSummary(cards, { paper, orientation: "landscape", layout }).perPage : 0,
    }), [cards, paper, layout]);
    // New run: the first time cards arrive, pick whichever orientation fits more per sheet
    const autoOriented = useRef(!!job);
    useEffect(() => {
        if (autoOriented.current || cards.length === 0) return;
        autoOriented.current = true;
        if (perOrientation.landscape > perOrientation.portrait) setOrientation("landscape");
    }, [cards.length, perOrientation]);
    const page = paperSize(paper, orientation);
    const totalCards = items.reduce((n, it) => n + (it.quantity || 0), 0);
    const jobKind: CardKind = (() => {
        const first = items[0];
        if (!first) return "business_card";
        if (first.source === "person") return "business_card";
        return designs.find((d) => d.id === first.source_id)?.kind ?? "event";
    })();

    // ── item editing ─────────────────────────────────────────────────────
    const markDirty = () => { dirty.current = true; setPdfUrl(null); setStatus("draft"); };

    function addPerson(p: Person) {
        markDirty();
        setItems((prev) => [...prev, { key: newKey(), source: "person", source_id: p.id, template_id: null, quantity: 10, include_back: true }]);
    }
    function addDesign(d: Design) {
        markDirty();
        setItems((prev) => [...prev, { key: newKey(), source: "design", source_id: d.id, template_id: null, quantity: 10, include_back: true }]);
    }
    function addCompany(companyId: string) {
        markDirty();
        const existing = new Set(items.filter((i) => i.source === "person").map((i) => i.source_id));
        const add = people.filter((p) => p.company_id === companyId && !existing.has(p.id))
            .map<ItemRow>((p) => ({ key: newKey(), source: "person", source_id: p.id, template_id: null, quantity: 10, include_back: true }));
        setItems((prev) => [...prev, ...add]);
    }
    function updateItem(key: string, patch: Partial<PrintItem>) {
        markDirty();
        setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
    }
    function removeItem(key: string) {
        markDirty();
        setItems((prev) => prev.filter((it) => it.key !== key));
    }
    function moveItem(key: string, dir: -1 | 1) {
        markDirty();
        setItems((prev) => {
            const idx = prev.findIndex((it) => it.key === key);
            const j = idx + dir;
            if (idx < 0 || j < 0 || j >= prev.length) return prev;
            const next = [...prev];
            [next[idx], next[j]] = [next[j], next[idx]];
            return next;
        });
    }
    function setLayoutField<K extends keyof PrintLayoutSettings>(k: K, v: PrintLayoutSettings[K]) {
        markDirty();
        setLayout((l) => ({ ...l, [k]: v }));
    }

    const itemLabel = useCallback((it: PrintItem) => {
        if (it.source === "person") {
            const p = people.find((x) => x.id === it.source_id);
            return p ? `${p.first_name} ${p.last_name}`.trim() : "Person";
        }
        return designs.find((x) => x.id === it.source_id)?.name ?? "Design";
    }, [people, designs]);

    const itemKind = useCallback((it: PrintItem): CardKind => {
        if (it.source === "person") return "business_card";
        return designs.find((x) => x.id === it.source_id)?.kind ?? "event";
    }, [designs]);

    const defaultTemplateId = useCallback((it: PrintItem): string | null => {
        if (it.source === "person") return people.find((x) => x.id === it.source_id)?.template_id ?? null;
        return designs.find((x) => x.id === it.source_id)?.template_id ?? null;
    }, [people, designs]);

    // ── persistence ──────────────────────────────────────────────────────
    async function saveJob(): Promise<string | null> {
        const api = clientApi();
        const body: Partial<PrintJob> = {
            name: name.trim() || `Print ${new Date().toLocaleDateString()}`,
            kind: jobKind,
            paper,
            orientation,
            items: plainItems,
            layout,
        };
        try {
            const saved = jobId ? await api.updatePrintJob(jobId, body) : await api.createPrintJob(body);
            setJobId(saved.id);
            setName(saved.name);
            dirty.current = false;
            if (!jobId) window.history.replaceState(null, "", `/print/${saved.id}`);
            return saved.id;
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not save print run");
            return null;
        }
    }

    async function handleSave() {
        if (items.length === 0) { setError("Add at least one card"); return; }
        setBusy("save"); setError(null);
        const id = await saveJob();
        setBusy(null);
        if (id) { toast("Print run saved"); router.refresh(); }
    }

    async function handleSavePdf() {
        if (!sheet || cards.length === 0) { setError("Nothing to print yet"); return; }
        setBusy("pdf"); setError(null);
        const id = await saveJob();
        if (!id) { setBusy(null); return; }
        try {
            // render WITHOUT the on-screen outlines
            const clean = buildSheetHtml(cards, { paper, orientation, layout, title: name || "Print sheet", previewOutlines: false });
            setStatus("rendering");
            const rendered = await clientApi().renderPrintJob(id, clean.html);
            setPdfUrl(rendered.pdf_url);
            setPageCount(rendered.page_count);
            setStatus(rendered.status);
            toast(`PDF ready — ${rendered.page_count} page${rendered.page_count === 1 ? "" : "s"}. Use "Download PDF" to save it.`);
        } catch (err) {
            setStatus("failed");
            setError(err instanceof ApiError ? `${err.message}${err.detail ? ` — ${err.detail}` : ""}` : "PDF render failed");
        } finally {
            setBusy(null);
        }
    }

    function handlePrint() {
        if (!sheet || cards.length === 0) { setError("Nothing to print yet"); return; }
        setBusy("print");
        // a dedicated print window gets the exact @page size (the preview iframe is scaled)
        const clean = buildSheetHtml(cards, { paper, orientation, layout, title: name || "Print sheet", previewOutlines: false });
        const w = window.open("", "_blank");
        if (!w) { setBusy(null); setError("Pop-up blocked — allow pop-ups to print"); return; }
        w.document.open();
        w.document.write(clean.html.replace("</body>", `<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},400);});</script></body>`));
        w.document.close();
        setBusy(null);
    }

    // ── picker data ──────────────────────────────────────────────────────
    const q = search.trim().toLowerCase();
    const pickerPeople = people
        .filter((p) => !pickerCompany || p.company_id === pickerCompany)
        .filter((p) => !q || `${p.first_name} ${p.last_name} ${p.title}`.toLowerCase().includes(q));
    const pickerDesigns = designs
        .filter((d) => pickerKind === "all" || d.kind === pickerKind)
        .filter((d) => !q || d.name.toLowerCase().includes(q));
    const inJob = new Set(items.map((i) => `${i.source}:${i.source_id}`));

    const previewW = page.width_mm * 3.7795 * zoom;
    const previewPages = sheet?.pages.length ?? 0;
    const previewH = (page.height_mm * 3.7795 + 12) * zoom * previewPages + 24;

    return (
        <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6">
            {/* Header */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <Link href="/print" className="text-sm text-zinc-500 hover:text-zinc-800">← Print runs</Link>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); dirty.current = true; }}
                    placeholder="Print run name (e.g. Acme staff cards, Oct 2026)"
                    className="w-full max-w-md rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium outline-none focus:border-zinc-500"
                />
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status === "ready" ? "bg-emerald-50 text-emerald-700" : status === "failed" ? "bg-red-50 text-red-600" : status === "rendering" ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>{status}</span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button onClick={handleSave} disabled={busy !== null} className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50">
                        {busy === "save" ? "Saving…" : "Save"}
                    </button>
                    <button onClick={handlePrint} disabled={busy !== null || cards.length === 0} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50">
                        🖨️ Print
                    </button>
                    <button onClick={handleSavePdf} disabled={busy !== null || cards.length === 0} className="rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white hover:bg-[#e55a2a] disabled:opacity-50">
                        {busy === "pdf" ? "Rendering PDF…" : "Save as PDF"}
                    </button>
                    {pdfUrl && (
                        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
                            ⬇ Download PDF{pageCount ? ` (${pageCount} p.)` : ""}
                        </a>
                    )}
                </div>
            </div>
            {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
            {skipped.length > 0 && (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Skipped (no template assigned): {skipped.join(", ")} — pick a template in the row below.
                </p>
            )}

            <div className="grid gap-6 xl:grid-cols-[360px_1fr_300px]">
                {/* ── Left: add cards ── */}
                <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Add cards</h2>
                        <div className="mb-3 flex gap-1 rounded-lg border border-zinc-200 p-0.5">
                            <button onClick={() => setPickerTab("people")} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${pickerTab === "people" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>💼 People</button>
                            <button onClick={() => setPickerTab("designs")} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${pickerTab === "designs" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>🎉 Designs</button>
                        </div>
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="mb-2 w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-zinc-500" />
                        {pickerTab === "people" ? (
                            <>
                                <div className="mb-2 flex gap-2">
                                    <select value={pickerCompany} onChange={(e) => setPickerCompany(e.target.value)} className="flex-1 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
                                        <option value="">All companies</option>
                                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    {pickerCompany && (
                                        <button onClick={() => addCompany(pickerCompany)} className="rounded-lg bg-zinc-100 px-2 py-1.5 text-xs font-medium hover:bg-zinc-200" title="Add everyone in this company">+ All</button>
                                    )}
                                </div>
                                <div className="max-h-72 space-y-1 overflow-y-auto">
                                    {pickerPeople.length === 0 && <p className="py-4 text-center text-xs text-zinc-400">No people{companies.length === 0 ? " — add a company first" : ""}.</p>}
                                    {pickerPeople.map((p) => {
                                        const added = inJob.has(`person:${p.id}`);
                                        return (
                                            <button key={p.id} onClick={() => addPerson(p)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-50">
                                                {p.photo_url ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img src={p.photo_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                                                ) : (
                                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-500">{p.first_name?.[0]}{p.last_name?.[0]}</span>
                                                )}
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-medium">{p.first_name} {p.last_name}</span>
                                                    <span className="block truncate text-xs text-zinc-500">{p.title || companies.find((c) => c.id === p.company_id)?.name}{!p.template_id ? " · no template" : ""}</span>
                                                </span>
                                                <span className={`text-xs ${added ? "text-emerald-600" : "text-zinc-400"}`}>{added ? "✓ added" : "+ add"}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        ) : (
                            <>
                                <select value={pickerKind} onChange={(e) => setPickerKind(e.target.value)} className="mb-2 w-full rounded-lg border border-zinc-300 px-2 py-1.5 text-sm">
                                    <option value="all">All types</option>
                                    {DESIGN_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.emoji} {k.plural}</option>)}
                                </select>
                                <div className="max-h-72 space-y-1 overflow-y-auto">
                                    {pickerDesigns.length === 0 && (
                                        <p className="py-4 text-center text-xs text-zinc-400">No designs yet. <Link href="/designs/new" className="text-sky-600 underline">Create one</Link>.</p>
                                    )}
                                    {pickerDesigns.map((d) => {
                                        const added = inJob.has(`design:${d.id}`);
                                        return (
                                            <button key={d.id} onClick={() => addDesign(d)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-zinc-50">
                                                <span className="text-lg">{getKind(d.kind).emoji}</span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-medium">{d.name}</span>
                                                    <span className="block truncate text-xs text-zinc-500">{getKind(d.kind).label}{!d.template_id ? " · no template" : ""}</span>
                                                </span>
                                                <span className={`text-xs ${added ? "text-emerald-600" : "text-zinc-400"}`}>{added ? "✓ added" : "+ add"}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Items in this run */}
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">In this run</h2>
                            <span className="text-xs text-zinc-500">{items.length} design{items.length === 1 ? "" : "s"} · {totalCards} cards</span>
                        </div>
                        {items.length === 0 ? (
                            <p className="text-sm text-zinc-400">Add people or designs above. Each row can use its own template and quantity — they all print on the same sheets.</p>
                        ) : (
                            <div className="space-y-2">
                                {items.map((it, idx) => {
                                    const kind = itemKind(it);
                                    const options = templates.filter((tp) => tp.kind === kind);
                                    const effective = it.template_id ?? defaultTemplateId(it);
                                    const tpl = templates.find((tp) => tp.id === effective);
                                    const person = it.source === "person" ? people.find((p) => p.id === it.source_id) : undefined;
                                    const company = person ? companies.find((c) => c.id === person.company_id) : undefined;
                                    const thumbData = person ? personCardData(person, company) : undefined;
                                    return (
                                        <div key={it.key} className="rounded-lg border border-zinc-200 p-2">
                                            <div className="flex items-center gap-2">
                                                <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-50">
                                                    {tpl && thumbData ? (
                                                        <CardPreviewRenderer config={tpl.config} data={thumbData} scale={Math.min(64 / tpl.config.width, 40 / tpl.config.height)} />
                                                    ) : (
                                                        <span className="text-lg">{getKind(kind).emoji}</span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium">{itemLabel(it)}</p>
                                                    <p className="truncate text-xs text-zinc-500">{tpl ? `${tpl.name} · ${tpl.width_mm}×${tpl.height_mm} mm` : "⚠ no template"}</p>
                                                </div>
                                                <div className="flex flex-col">
                                                    <button onClick={() => moveItem(it.key, -1)} disabled={idx === 0} className="text-xs text-zinc-400 hover:text-zinc-700 disabled:opacity-30">▲</button>
                                                    <button onClick={() => moveItem(it.key, 1)} disabled={idx === items.length - 1} className="text-xs text-zinc-400 hover:text-zinc-700 disabled:opacity-30">▼</button>
                                                </div>
                                                <button onClick={() => removeItem(it.key)} className="text-zinc-400 hover:text-red-500" title="Remove">&times;</button>
                                            </div>
                                            <div className="mt-2 grid grid-cols-[1fr_72px_auto] items-center gap-2">
                                                <select
                                                    value={it.template_id ?? ""}
                                                    onChange={(e) => updateItem(it.key, { template_id: e.target.value || null })}
                                                    className="min-w-0 rounded border border-zinc-300 px-2 py-1 text-xs"
                                                    title="Template for this row"
                                                >
                                                    <option value="">{defaultTemplateId(it) ? `Default (${templates.find((tp) => tp.id === defaultTemplateId(it))?.name ?? "assigned"})` : "— choose template —"}</option>
                                                    {options.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}{tp.is_builtin ? " (built-in)" : ""}</option>)}
                                                </select>
                                                <input
                                                    type="number" min={1} max={1000}
                                                    value={it.quantity}
                                                    onChange={(e) => updateItem(it.key, { quantity: Math.max(1, Math.min(1000, Number(e.target.value) || 1)) })}
                                                    className="rounded border border-zinc-300 px-2 py-1 text-xs"
                                                    title="Quantity"
                                                />
                                                <label className={`flex items-center gap-1 text-xs ${tpl?.has_back ? "text-zinc-600" : "text-zinc-300"}`} title={tpl?.has_back ? "Print the back side" : "This template has no back side"}>
                                                    <input type="checkbox" checked={it.include_back && !!tpl?.has_back} disabled={!tpl?.has_back} onChange={(e) => updateItem(it.key, { include_back: e.target.checked })} />
                                                    back
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Middle: preview ── */}
                <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
                        <span className="font-medium">Preview</span>
                        {summary && (
                            <span className="text-zinc-500">
                                {summary.cols} × {summary.rows} = <b>{summary.perPage}</b> per sheet · <b>{summary.pages}</b> sheet{summary.pages === 1 ? "" : "s"}
                                {summary.backs > 0 ? ` (${summary.fronts} front + ${summary.backs} back)` : ""} · {summary.cards} cards
                            </span>
                        )}
                        {building && <span className="text-xs text-amber-600">Building…</span>}
                        <div className="ml-auto flex items-center gap-2 text-xs">
                            Zoom
                            <input type="range" min={0.25} max={1.2} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
                            {Math.round(zoom * 100)}%
                        </div>
                    </div>
                    <div className="overflow-auto rounded-xl border border-zinc-200 bg-zinc-200" style={{ maxHeight: "calc(100vh - 180px)" }}>
                        {sheetHtml ? (
                            <div style={{ width: Math.max(previewW + 24, 320), height: previewH, position: "relative" }}>
                                <iframe
                                    ref={iframeRef}
                                    title="Print preview"
                                    srcDoc={sheetHtml}
                                    style={{
                                        width: page.width_mm * 3.7795 + 24,
                                        height: previewH / zoom,
                                        transform: `scale(${zoom})`,
                                        transformOrigin: "top left",
                                        border: "none",
                                        background: "transparent",
                                    }}
                                />
                            </div>
                        ) : (
                            <div className="flex h-[480px] items-center justify-center text-sm text-zinc-500">
                                {items.length === 0 ? "Add cards to see the sheet layout" : building ? "Building preview…" : "Preparing…"}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right: paper & layout ── */}
                <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Paper</h2>
                        <div className="mb-3 grid grid-cols-3 gap-1">
                            {(Object.keys(PAPERS) as (keyof typeof PAPERS)[]).map((p) => (
                                <button key={p} onClick={() => { setPaper(p); markDirty(); }} className={`rounded-md border px-2 py-1.5 text-xs font-medium ${paper === p ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:border-zinc-400"}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                        <div className="mb-3 flex gap-1 rounded-lg border border-zinc-200 p-0.5">
                            <button onClick={() => { setOrientation("portrait"); markDirty(); }} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${orientation === "portrait" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>
                                Portrait{cards.length ? ` · ${perOrientation.portrait}/sheet` : ""}
                            </button>
                            <button onClick={() => { setOrientation("landscape"); markDirty(); }} className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium ${orientation === "landscape" ? "bg-zinc-900 text-white" : "hover:bg-zinc-100"}`}>
                                Landscape{cards.length ? ` · ${perOrientation.landscape}/sheet` : ""}
                            </button>
                        </div>
                        <p className="text-xs text-zinc-500">{page.width_mm} × {page.height_mm} mm</p>
                    </div>

                    <div className="rounded-xl border border-zinc-200 bg-white p-4">
                        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Layout</h2>
                        <div className="grid grid-cols-2 gap-3">
                            <label className="text-xs text-zinc-600">
                                Margin (mm)
                                <input type="number" min={0} max={50} step={0.5} value={layout.margin_mm} onChange={(e) => setLayoutField("margin_mm", Number(e.target.value) || 0)} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" />
                            </label>
                            <label className="text-xs text-zinc-600">
                                Gap (mm)
                                <input type="number" min={0} max={30} step={0.5} value={layout.gap_mm} onChange={(e) => setLayoutField("gap_mm", Number(e.target.value) || 0)} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" />
                            </label>
                            <label className="text-xs text-zinc-600">
                                Scale
                                <select value={layout.scale} onChange={(e) => setLayoutField("scale", Number(e.target.value))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm">
                                    <option value={1}>100% (actual size)</option>
                                    <option value={0.9}>90%</option>
                                    <option value={0.8}>80%</option>
                                    <option value={0.75}>75%</option>
                                    <option value={0.5}>50%</option>
                                    <option value={1.1}>110%</option>
                                    <option value={1.25}>125%</option>
                                    <option value={1.5}>150%</option>
                                    <option value={2}>200%</option>
                                </select>
                            </label>
                            <label className="text-xs text-zinc-600">
                                Back sides
                                <select value={layout.back_mode} onChange={(e) => setLayoutField("back_mode", e.target.value as PrintLayoutSettings["back_mode"])} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm">
                                    <option value="duplex">Duplex (front, back, front…)</option>
                                    <option value="separate">All fronts, then all backs</option>
                                    <option value="none">Fronts only</option>
                                </select>
                            </label>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {[["Borderless", 0, 0], ["Tight", 3, 2], ["Normal", 5, 3], ["Safe", 10, 4]].map(([label, m, g]) => (
                                <button key={label as string} onClick={() => { setLayout((l) => ({ ...l, margin_mm: m as number, gap_mm: g as number })); markDirty(); }} className={`rounded-full border px-2 py-0.5 text-[11px] ${layout.margin_mm === m && layout.gap_mm === g ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 hover:border-zinc-400"}`}>
                                    {label as string} ({m as number}/{g as number} mm)
                                </button>
                            ))}
                        </div>
                        <label className="mt-3 flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={layout.auto_fit} onChange={(e) => setLayoutField("auto_fit", e.target.checked)} />
                            Fit as many as possible
                        </label>
                        {!layout.auto_fit && (
                            <div className="mt-2 grid grid-cols-2 gap-3">
                                <label className="text-xs text-zinc-600">
                                    Columns
                                    <input type="number" min={1} max={20} value={layout.cols ?? summary?.cols ?? 2} onChange={(e) => setLayoutField("cols", Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" />
                                </label>
                                <label className="text-xs text-zinc-600">
                                    Rows
                                    <input type="number" min={1} max={30} value={layout.rows ?? summary?.rows ?? 5} onChange={(e) => setLayoutField("rows", Math.max(1, Number(e.target.value) || 1))} className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm" />
                                </label>
                            </div>
                        )}
                        <label className="mt-2 flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={layout.crop_marks} onChange={(e) => setLayoutField("crop_marks", e.target.checked)} />
                            Crop marks
                        </label>
                        <p className="mt-3 text-xs text-zinc-400">
                            Back pages are mirrored for a long-edge duplex flip. When printing, set the printer to <b>Actual size / 100%</b> and no margins.
                        </p>
                    </div>

                    {summary && (
                        <div className="rounded-xl border border-zinc-200 bg-white p-4 text-sm">
                            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-zinc-400">Summary</h2>
                            <dl className="grid grid-cols-2 gap-y-1 text-zinc-600">
                                <dt>Cards</dt><dd className="text-right font-medium">{summary.cards}</dd>
                                <dt>Per sheet</dt><dd className="text-right font-medium">{summary.perPage}</dd>
                                <dt>Sheets</dt><dd className="text-right font-medium">{summary.pages}</dd>
                                <dt>Paper</dt><dd className="text-right font-medium">{paper} {orientation}</dd>
                            </dl>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

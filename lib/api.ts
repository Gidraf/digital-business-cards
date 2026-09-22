/**
 * Typed client for the CVPAP Cards & Print API.
 *
 * Works in both client components (token from the cookie) and server
 * components (pass the token explicitly via `createApi(token, partnerId)`).
 * Every partner-scoped call goes to /api/v1/cards/<partner_id>/…
 */
import { getClientSession, getClientToken } from "./auth";
import type {
    Asset, CardKind, CardTemplate, Company, Design, Person, PrintEvent, PrintItem,
    PrintJob, PrintMaterials, Report, TemplateConfig,
} from "./types";
import type { Pricing } from "./pricing";

export class ApiError extends Error {
    status: number;
    code?: string;
    detail?: string;
    constructor(status: number, message: string, code?: string, detail?: string) {
        super(message);
        this.status = status;
        this.code = code;
        this.detail = detail;
    }
}

export function apiBase(): string {
    // Server components may use an internal URL (docker network); browsers use the public one.
    if (typeof window === "undefined" && process.env.CVPAP_API_URL) return process.env.CVPAP_API_URL.replace(/\/$/, "");
    return (process.env.NEXT_PUBLIC_CVPAP_API_URL ?? "http://localhost:5000").replace(/\/$/, "");
}

export interface ApiContext {
    token: string | null;
    partnerId: string | null;
}

async function request<T>(ctx: ApiContext, path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    if (ctx.token) headers.set("Authorization", `Bearer ${ctx.token}`);
    const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
    if (!isForm && init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");

    const res = await fetch(`${apiBase()}${path}`, { ...init, headers, cache: "no-store" });
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    if (!res.ok) {
        const b = (body ?? {}) as { error?: unknown; msg?: string; detail?: string; code?: string };
        const err = typeof b.error === "string" ? b.error
            : b.error && typeof b.error === "object" && "message" in (b.error as object) ? String((b.error as { message: unknown }).message)
            : b.msg ?? `Request failed (${res.status})`;
        if (res.status === 401 && typeof window !== "undefined") {
            // token expired / invalid — bounce to login, keep the return path
            const next = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/login?expired=1&next=${next}`;
        }
        throw new ApiError(res.status, err, b.code, b.detail);
    }
    return body as T;
}

function scopedPath(ctx: ApiContext, rest: string): string {
    if (!ctx.partnerId) throw new ApiError(400, "No partner selected");
    return `/api/v1/cards/${ctx.partnerId}${rest}`;
}

function form(fields: Record<string, string | Blob | null | undefined>): FormData {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) {
        if (v === null || v === undefined) continue;
        fd.append(k, v);
    }
    return fd;
}

export function createApi(ctx: ApiContext) {
    const s = (rest: string) => scopedPath(ctx, rest);
    return {
        ctx,

        // ── session ──────────────────────────────────────────────────────
        me: (partnerId?: string) =>
            request<{ user: { id: string; name: string; email: string | null; username?: string }; account_type: "admin" | "partner"; partner_id: string | null; partner: { id: string; name: string; email: string | null } | null; kinds: CardKind[]; papers: Record<string, { width_mm: number; height_mm: number }> }>(
                ctx, `/api/v1/cards/me${partnerId ? `?partner_id=${encodeURIComponent(partnerId)}` : ""}`),
        partners: () => request<{ partners: { id: string; name: string; email: string | null }[] }>(ctx, "/api/v1/cards/partners"),
        summary: () => request<{ companies: number; people: number; templates: number; builtin_templates: number; designs: number; print_jobs: number }>(ctx, s("/summary")),

        // ── companies ────────────────────────────────────────────────────
        listCompanies: () => request<{ companies: Company[] }>(ctx, s("/companies")).then((r) => r.companies),
        getCompany: (id: string) => request<{ company: Company; people: Person[] }>(ctx, s(`/companies/${id}`)),
        createCompany: (body: Partial<Company>) => request<{ company: Company }>(ctx, s("/companies"), { method: "POST", body: JSON.stringify(body) }).then((r) => r.company),
        updateCompany: (id: string, body: Partial<Company>) => request<{ company: Company }>(ctx, s(`/companies/${id}`), { method: "PUT", body: JSON.stringify(body) }).then((r) => r.company),
        deleteCompany: (id: string) => request<{ deleted: boolean }>(ctx, s(`/companies/${id}`), { method: "DELETE" }),
        uploadLogo: (id: string, file: Blob, filename = "logo.png") => request<{ company: Company }>(ctx, s(`/companies/${id}/logo`), { method: "POST", body: form({ file: new File([file], filename, { type: file.type }) }) }).then((r) => r.company),
        deleteLogo: (id: string) => request<{ company: Company }>(ctx, s(`/companies/${id}/logo`), { method: "DELETE" }).then((r) => r.company),

        // ── people ───────────────────────────────────────────────────────
        listPeople: (companyId?: string) => request<{ people: Person[] }>(ctx, s(`/people${companyId ? `?company_id=${companyId}` : ""}`)).then((r) => r.people),
        getPerson: (id: string) => request<{ person: Person }>(ctx, s(`/people/${id}`)).then((r) => r.person),
        createPerson: (companyId: string, body: Partial<Person>) => request<{ person: Person }>(ctx, s(`/companies/${companyId}/people`), { method: "POST", body: JSON.stringify(body) }).then((r) => r.person),
        bulkCreatePeople: (companyId: string, people: Partial<Person>[], templateId?: string | null) => request<{ created: number; people: Person[] }>(ctx, s(`/companies/${companyId}/people/bulk`), { method: "POST", body: JSON.stringify({ people, template_id: templateId ?? null }) }),
        updatePerson: (id: string, body: Partial<Person>) => request<{ person: Person }>(ctx, s(`/people/${id}`), { method: "PUT", body: JSON.stringify(body) }).then((r) => r.person),
        deletePerson: (id: string) => request<{ deleted: boolean }>(ctx, s(`/people/${id}`), { method: "DELETE" }),
        uploadPhoto: (id: string, file: Blob, filename = "photo.jpg") => request<{ person: Person }>(ctx, s(`/people/${id}/photo`), { method: "POST", body: form({ file: new File([file], filename, { type: file.type }) }) }).then((r) => r.person),
        deletePhoto: (id: string) => request<{ person: Person }>(ctx, s(`/people/${id}/photo`), { method: "DELETE" }).then((r) => r.person),

        // ── templates ────────────────────────────────────────────────────
        listTemplates: (kind?: CardKind | string, withConfig = true) => request<{ templates: CardTemplate[] }>(ctx, s(`/templates?${kind ? `kind=${kind}&` : ""}config=${withConfig ? 1 : 0}`)).then((r) => r.templates),
        getTemplate: (id: string) => request<{ template: CardTemplate }>(ctx, s(`/templates/${id}`)).then((r) => r.template),
        createTemplate: (body: { name: string; kind: CardKind; config: TemplateConfig; back_config?: TemplateConfig | null; width_mm: number; height_mm: number }) => request<{ template: CardTemplate }>(ctx, s("/templates"), { method: "POST", body: JSON.stringify(body) }).then((r) => r.template),
        updateTemplate: (id: string, body: Partial<{ name: string; kind: CardKind; config: TemplateConfig; back_config: TemplateConfig | null; width_mm: number; height_mm: number }>) => request<{ template: CardTemplate }>(ctx, s(`/templates/${id}`), { method: "PUT", body: JSON.stringify(body) }).then((r) => r.template),
        deleteTemplate: (id: string) => request<{ deleted: boolean }>(ctx, s(`/templates/${id}`), { method: "DELETE" }),
        duplicateTemplate: (id: string, name?: string) => request<{ template: CardTemplate }>(ctx, s(`/templates/${id}/duplicate`), { method: "POST", body: JSON.stringify({ name }) }).then((r) => r.template),

        // ── assets ───────────────────────────────────────────────────────
        listAssets: (companyId?: string | null) => request<{ assets: Asset[] }>(ctx, s(`/assets${companyId ? `?company_id=${companyId}` : ""}`)).then((r) => r.assets),
        resolveAssets: (ids: string[]) => ids.length ? request<{ urls: Record<string, string | null> }>(ctx, s("/assets/resolve"), { method: "POST", body: JSON.stringify({ ids }) }).then((r) => r.urls) : Promise.resolve({} as Record<string, string | null>),
        uploadAssets: (files: File[], companyId?: string | null) => {
            const fd = new FormData();
            for (const f of files) fd.append("file", f);
            if (companyId) fd.append("company_id", companyId);
            return request<{ assets: Asset[] }>(ctx, s("/assets"), { method: "POST", body: fd }).then((r) => r.assets);
        },
        deleteAsset: (id: string) => request<{ deleted: boolean }>(ctx, s(`/assets/${id}`), { method: "DELETE" }),

        // ── designs ──────────────────────────────────────────────────────
        listDesigns: (kind?: CardKind | string) => request<{ designs: Design[] }>(ctx, s(`/designs${kind ? `?kind=${kind}` : ""}`)).then((r) => r.designs),
        getDesign: (id: string) => request<{ design: Design }>(ctx, s(`/designs/${id}`)).then((r) => r.design),
        createDesign: (body: { name: string; kind: CardKind; template_id?: string | null; data: Record<string, string> }) => request<{ design: Design }>(ctx, s("/designs"), { method: "POST", body: JSON.stringify(body) }).then((r) => r.design),
        updateDesign: (id: string, body: Partial<{ name: string; kind: CardKind; template_id: string | null; data: Record<string, string> }>) => request<{ design: Design }>(ctx, s(`/designs/${id}`), { method: "PUT", body: JSON.stringify(body) }).then((r) => r.design),
        deleteDesign: (id: string) => request<{ deleted: boolean }>(ctx, s(`/designs/${id}`), { method: "DELETE" }),
        uploadDesignImage: (id: string, field: "logo" | "photo", file: Blob, filename = "image.jpg") => request<{ design: Design }>(ctx, s(`/designs/${id}/images/${field}`), { method: "POST", body: form({ file: new File([file], filename, { type: file.type }) }) }).then((r) => r.design),
        deleteDesignImage: (id: string, field: "logo" | "photo") => request<{ design: Design }>(ctx, s(`/designs/${id}/images/${field}`), { method: "DELETE" }).then((r) => r.design),

        // ── print jobs ───────────────────────────────────────────────────
        listPrintJobs: () => request<{ print_jobs: PrintJob[] }>(ctx, s("/print-jobs")).then((r) => r.print_jobs),
        getPrintJob: (id: string) => request<{ print_job: PrintJob }>(ctx, s(`/print-jobs/${id}`)).then((r) => r.print_job),
        createPrintJob: (body: Partial<PrintJob>) => request<{ print_job: PrintJob }>(ctx, s("/print-jobs"), { method: "POST", body: JSON.stringify(body) }).then((r) => r.print_job),
        updatePrintJob: (id: string, body: Partial<PrintJob>) => request<{ print_job: PrintJob }>(ctx, s(`/print-jobs/${id}`), { method: "PUT", body: JSON.stringify(body) }).then((r) => r.print_job),
        deletePrintJob: (id: string) => request<{ deleted: boolean }>(ctx, s(`/print-jobs/${id}`), { method: "DELETE" }),
        printJobMaterials: (id: string) => request<PrintMaterials>(ctx, s(`/print-jobs/${id}/materials`)),
        printMaterials: (items: PrintItem[]) => request<PrintMaterials>(ctx, s("/print-materials"), { method: "POST", body: JSON.stringify({ items }) }),
        renderPrintJob: (id: string, html: string) => request<{ print_job: PrintJob }>(ctx, s(`/print-jobs/${id}/render`), { method: "POST", body: JSON.stringify({ html }) }).then((r) => r.print_job),
        recordPrint: (id: string, body: { method: "browser" | "pdf" | "manual"; copies?: number; cards?: number; sheets?: number; amount?: number; note?: string }) => request<{ event: PrintEvent; print_job: PrintJob }>(ctx, s(`/print-jobs/${id}/printed`), { method: "POST", body: JSON.stringify(body) }),
        listPrintEvents: (jobId?: string) => request<{ events: PrintEvent[] }>(ctx, s(`/print-events${jobId ? `?job_id=${jobId}` : ""}`)).then((r) => r.events),
        deletePrintEvent: (id: string) => request<{ deleted: boolean }>(ctx, s(`/print-events/${id}`), { method: "DELETE" }),

        // ── pricing & reports ────────────────────────────────────────────
        getPricing: () => request<{ pricing: Pricing; defaults: Pricing }>(ctx, s("/pricing")),
        updatePricing: (pricing: Pricing) => request<{ pricing: Pricing }>(ctx, s("/pricing"), { method: "PUT", body: JSON.stringify({ pricing }) }).then((r) => r.pricing),
        reports: (from?: string, to?: string) => request<Report>(ctx, s(`/reports?${from ? `from=${from}&` : ""}${to ? `to=${to}` : ""}`)),

        printJobPdfUrl: (id: string, inline = false) => `${apiBase()}${s(`/print-jobs/${id}/pdf${inline ? "?inline=1" : ""}`)}`,
        renderPdf: async (html: string, filename = "cards"): Promise<Blob> => {
            const headers = new Headers({ "Content-Type": "application/json" });
            if (ctx.token) headers.set("Authorization", `Bearer ${ctx.token}`);
            const res = await fetch(`${apiBase()}${s("/render-pdf")}`, { method: "POST", headers, body: JSON.stringify({ html, filename }) });
            if (!res.ok) {
                let detail = "";
                try { detail = ((await res.json()) as { detail?: string }).detail ?? ""; } catch { /* ignore */ }
                throw new ApiError(res.status, "PDF render failed", undefined, detail);
            }
            return res.blob();
        },
    };
}

export type Api = ReturnType<typeof createApi>;

/** Client-component helper: builds an API bound to the current cookie session. */
export function clientApi(): Api {
    const session = getClientSession();
    return createApi({ token: getClientToken(), partnerId: session?.partner_id ?? null });
}

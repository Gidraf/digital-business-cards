"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi } from "@/lib/api";
import { getKind } from "@/lib/card-kinds";
import { money } from "@/lib/pricing";
import { fmtDateTime } from "@/lib/format";
import type { Report, PrintEvent } from "@/lib/types";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./ToastProvider";

function shiftDays(iso: string, days: number): string {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
}

export default function ReportsContent({ report, currency, unavailable = null }: { report: Report; currency: string; unavailable?: string | null }) {
    const router = useRouter();
    const { toast } = useToast();
    const [toDelete, setToDelete] = useState<PrintEvent | null>(null);
    const today = new Date().toISOString().slice(0, 10);
    // report.from/to are blank when the reports call failed — fall back to the last 30 days
    const [from, setFrom] = useState(report.from || shiftDays(today, -29));
    const [to, setTo] = useState(report.to || today);
    const t = report.totals;
    const activeDays = report.days.filter((d) => d.prints > 0 || d.created_designs > 0 || d.created_people > 0 || d.created_jobs > 0 || d.created_templates > 0);

    function go(f: string, tt: string) {
        router.push(`/reports?from=${f}&to=${tt}`);
    }

    async function handleDelete() {
        if (!toDelete) return;
        try {
            await clientApi().deletePrintEvent(toDelete.id);
            toast("Print record removed");
            router.refresh();
        } catch {
            toast("Could not remove", "error");
        }
        setToDelete(null);
    }

    const kpi = (label: string, value: string | number, sub?: string) => (
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-zinc-400">{sub}</p>}
        </div>
    );

    return (
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
                    <p className="mt-1 text-sm text-zinc-500">What was created and what was printed, per day.</p>
                </div>
                <Link href="/settings/pricing" className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Pricing</Link>
            </div>

            {unavailable && (
                <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Reports are unavailable right now ({unavailable}). If the API was just updated it may still be restarting — reload in a moment.
                </p>
            )}

            <div className="mb-6 flex flex-wrap items-end gap-2 rounded-xl border border-zinc-200 bg-white p-4">
                <label className="text-xs text-zinc-600">From<input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="mt-1 block rounded border border-zinc-300 px-2 py-1 text-sm" /></label>
                <label className="text-xs text-zinc-600">To<input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} className="mt-1 block rounded border border-zinc-300 px-2 py-1 text-sm" /></label>
                <button onClick={() => go(from, to)} className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">Show</button>
                <div className="ml-auto flex flex-wrap gap-1">
                    {[["Today", 0], ["7 days", 6], ["30 days", 29], ["90 days", 89]].map(([label, n]) => (
                        <button key={label as string} onClick={() => go(shiftDays(today, -(n as number)), today)} className="rounded-full border border-zinc-200 px-3 py-1 text-xs hover:border-zinc-400">{label as string}</button>
                    ))}
                </div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
                {kpi("Revenue", money(t.revenue, currency), `${report.from || from} → ${report.to || to}`)}
                {kpi("Cards printed", t.printed_cards, `${t.prints} print run${t.prints === 1 ? "" : "s"}`)}
                {kpi("Sheets printed", t.printed_sheets, "paper used")}
                {kpi("Designs created", t.created_designs, "events, harambee, flyers…")}
                {kpi("People added", t.created_people, "business-card holders")}
                {kpi("Print runs created", t.created_jobs, `${t.created_templates} templates`)}
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
                <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">Per day</h2>
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                        <table className="w-full text-sm">
                            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                                <tr>
                                    <th className="px-3 py-2">Date</th>
                                    <th className="px-3 py-2 text-right">Designs</th>
                                    <th className="px-3 py-2 text-right">People</th>
                                    <th className="px-3 py-2 text-right">Runs</th>
                                    <th className="px-3 py-2 text-right">Prints</th>
                                    <th className="px-3 py-2 text-right">Cards</th>
                                    <th className="px-3 py-2 text-right">Sheets</th>
                                    <th className="px-3 py-2 text-right">Revenue</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeDays.length === 0 && (
                                    <tr><td colSpan={8} className="px-3 py-8 text-center text-zinc-400">Nothing in this period yet.</td></tr>
                                )}
                                {[...activeDays].reverse().map((d) => (
                                    <tr key={d.date} className="border-t border-zinc-100">
                                        <td className="px-3 py-2 font-medium">{d.date}</td>
                                        <td className="px-3 py-2 text-right">{d.created_designs}</td>
                                        <td className="px-3 py-2 text-right">{d.created_people}</td>
                                        <td className="px-3 py-2 text-right">{d.created_jobs}</td>
                                        <td className="px-3 py-2 text-right">{d.prints}</td>
                                        <td className="px-3 py-2 text-right font-medium">{d.printed_cards}</td>
                                        <td className="px-3 py-2 text-right">{d.printed_sheets}</td>
                                        <td className="px-3 py-2 text-right font-medium">{money(d.revenue, currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {activeDays.length > 0 && (
                                <tfoot className="border-t border-zinc-200 bg-zinc-50 font-semibold">
                                    <tr>
                                        <td className="px-3 py-2">Total</td>
                                        <td className="px-3 py-2 text-right">{t.created_designs}</td>
                                        <td className="px-3 py-2 text-right">{t.created_people}</td>
                                        <td className="px-3 py-2 text-right">{t.created_jobs}</td>
                                        <td className="px-3 py-2 text-right">{t.prints}</td>
                                        <td className="px-3 py-2 text-right">{t.printed_cards}</td>
                                        <td className="px-3 py-2 text-right">{t.printed_sheets}</td>
                                        <td className="px-3 py-2 text-right">{money(t.revenue, currency)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>

                    <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-zinc-400">Print log</h2>
                    <div className="grid gap-2">
                        {report.events.length === 0 && <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">No prints recorded in this period.</p>}
                        {report.events.map((e) => (
                            <div key={e.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm">
                                <span className="text-lg">{getKind(e.kind).emoji}</span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate font-medium">{e.job_id ? <Link href={`/print/${e.job_id}`} className="hover:underline">{e.job_name || "Print run"}</Link> : (e.job_name || "Print run")}</p>
                                    <p className="text-xs text-zinc-500" suppressHydrationWarning>
                                        {fmtDateTime(e.created_at)} · {e.cards} cards · {e.sheets} sheets · {e.paper} · {e.method}{e.note ? ` · ${e.note}` : ""}
                                    </p>
                                </div>
                                <span className="font-semibold">{money(e.amount, currency)}</span>
                                <button onClick={() => setToDelete(e)} className="text-xs text-zinc-400 hover:text-red-500" title="Remove this record">&times;</button>
                            </div>
                        ))}
                    </div>
                </div>

                <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">By card type</h2>
                    <div className="grid gap-2">
                        {report.by_kind.length === 0 && <p className="text-sm text-zinc-400">—</p>}
                        {report.by_kind.map((k) => (
                            <div key={k.kind} className="rounded-xl border border-zinc-200 bg-white p-3 text-sm">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{getKind(k.kind).emoji} {getKind(k.kind).plural}</span>
                                    <span className="font-semibold">{money(k.revenue, currency)}</span>
                                </div>
                                <p className="text-xs text-zinc-500">{k.cards} cards · {k.sheets} sheets · {k.prints} prints</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {toDelete && (
                <ConfirmModal
                    title="Remove print record"
                    message={`Remove the record of ${toDelete.cards} cards (${money(toDelete.amount, currency)})? Use this only if it was logged by mistake.`}
                    confirmLabel="Remove"
                    destructive
                    onConfirm={handleDelete}
                    onCancel={() => setToDelete(null)}
                />
            )}
        </div>
    );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clientApi } from "@/lib/api";
import { getKind } from "@/lib/card-kinds";
import type { PrintJob } from "@/lib/types";
import { fmtDateTime } from "@/lib/format";
import ConfirmModal from "./ConfirmModal";
import { useToast } from "./ToastProvider";

const STATUS_STYLE: Record<PrintJob["status"], string> = {
    draft: "bg-zinc-100 text-zinc-600",
    rendering: "bg-amber-50 text-amber-700",
    ready: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-600",
};

export default function PrintJobsContent({ jobs }: { jobs: PrintJob[] }) {
    const router = useRouter();
    const { toast } = useToast();
    const [toDelete, setToDelete] = useState<PrintJob | null>(null);

    async function handleDelete() {
        if (!toDelete) return;
        try {
            await clientApi().deletePrintJob(toDelete.id);
            toast("Print run deleted");
            router.refresh();
        } catch {
            toast("Could not delete", "error");
        }
        setToDelete(null);
    }

    return (
        <div className="mx-auto w-full max-w-5xl px-6 py-10">
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Print</h1>
                    <p className="mt-1 text-sm text-zinc-500">Lay cards out on A4/A3/Letter sheets, mix designs on one sheet, then print directly or save a PDF.</p>
                </div>
                <Link href="/print/new" className="rounded-lg bg-[#FF6B35] px-4 py-2 text-sm font-medium text-white hover:bg-[#e55a2a]">
                    + New print run
                </Link>
            </div>

            {jobs.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-300 px-6 py-16 text-center">
                    <p className="font-medium text-zinc-700">No print runs yet</p>
                    <p className="mt-1 text-sm text-zinc-500">Start one from a company page, a design, or the button above.</p>
                </div>
            ) : (
                <div className="grid gap-3">
                    {jobs.map((job) => (
                        <div key={job.id} className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4">
                            <Link href={`/print/${job.id}`} className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-zinc-900">{job.name}</p>
                                <p className="text-sm text-zinc-500" suppressHydrationWarning>
                                    {getKind(job.kind).emoji} {job.card_count} cards · {job.items.length} design{job.items.length === 1 ? "" : "s"} · {job.paper} {job.orientation}
                                    {job.page_count ? ` · ${job.page_count} pages` : ""}
                                    {job.updated_at ? ` · ${fmtDateTime(job.updated_at)}` : ""}{job.printed_count ? ` · 🖨 ${job.printed_count} printed` : ""}
                                </p>
                            </Link>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[job.status]}`}>{job.status}</span>
                            {job.pdf_url && (
                                <a href={job.pdf_url} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50" target="_blank" rel="noopener noreferrer">
                                    ⬇ PDF
                                </a>
                            )}
                            <Link href={`/print/${job.id}`} className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700">Open</Link>
                            <button onClick={() => setToDelete(job)} className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600">Delete</button>
                        </div>
                    ))}
                </div>
            )}

            {toDelete && (
                <ConfirmModal
                    title="Delete print run"
                    message={`Delete "${toDelete.name}" and its PDF?`}
                    confirmLabel="Delete"
                    destructive
                    onConfirm={handleDelete}
                    onCancel={() => setToDelete(null)}
                />
            )}
        </div>
    );
}

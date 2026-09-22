"use client";

import Link from "next/link";
import { useTranslation } from "./I18nProvider";
import { getKind, DESIGN_KINDS } from "@/lib/card-kinds";
import type { CardTemplate, Company, Design, PrintJob } from "@/lib/types";

interface DashboardContentProps {
    partnerName: string;
    summary: { companies: number; people: number; templates: number; builtin_templates: number; designs: number; print_jobs: number };
    companies: Company[];
    templates: CardTemplate[];
    designs: Design[];
    printJobs: PrintJob[];
}

const STATUS_STYLE: Record<PrintJob["status"], string> = {
    draft: "bg-zinc-100 text-zinc-600",
    rendering: "bg-amber-50 text-amber-700",
    ready: "bg-emerald-50 text-emerald-700",
    failed: "bg-red-50 text-red-600",
};

export default function DashboardContent({ partnerName, summary, companies, templates, designs, printJobs }: DashboardContentProps) {
    const { t } = useTranslation();

    return (
        <div className="mx-auto w-full max-w-6xl px-6 py-10">
            <div className="mb-10">
                <h1 className="text-3xl font-bold tracking-tight">{t.dash_title}</h1>
                <p className="mt-1 text-zinc-500">{partnerName} · {t.dash_welcome}</p>
            </div>

            <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-5">
                <Link href="/companies" className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:shadow-sm">
                    <p className="text-sm text-zinc-500">{t.dash_companies}</p>
                    <p className="mt-1 text-2xl font-bold">{summary.companies}</p>
                </Link>
                <Link href="/companies" className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:shadow-sm">
                    <p className="text-sm text-zinc-500">{t.dash_people}</p>
                    <p className="mt-1 text-2xl font-bold">{summary.people}</p>
                </Link>
                <Link href="/designs" className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:shadow-sm">
                    <p className="text-sm text-zinc-500">{t.nav_designs}</p>
                    <p className="mt-1 text-2xl font-bold">{summary.designs}</p>
                </Link>
                <Link href="/templates" className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:shadow-sm">
                    <p className="text-sm text-zinc-500">{t.dash_templates}</p>
                    <p className="mt-1 text-2xl font-bold">{summary.templates}<span className="ml-1 text-sm font-normal text-zinc-400">+{summary.builtin_templates} built-in</span></p>
                </Link>
                <Link href="/reports" className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:shadow-sm">
                    <p className="text-sm text-zinc-500">{t.nav_print}</p>
                    <p className="mt-1 text-2xl font-bold">{summary.print_jobs}<span className="ml-1 text-sm font-normal text-zinc-400">runs · reports →</span></p>
                </Link>
            </div>

            <div className="mb-10">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">{t.dash_quick_actions}</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Link href="/print/new" className="rounded-xl border-2 border-[#FF6B35] bg-white p-5 transition hover:shadow-sm">
                        <p className="font-medium text-zinc-900">🖨️ New print run</p>
                        <p className="mt-1 text-sm text-zinc-500">Lay cards out on A4/A3, preview, then print or save as PDF.</p>
                    </Link>
                    <Link href="/companies" className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm">
                        <p className="font-medium text-zinc-900">{t.dash_add_company}</p>
                        <p className="mt-1 text-sm text-zinc-500">{t.dash_add_company_desc}</p>
                    </Link>
                    <Link href="/designs/new" className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm">
                        <p className="font-medium text-zinc-900">🎉 New event / celebration card</p>
                        <p className="mt-1 text-sm text-zinc-500">Harambee, birthday, baby shower, wedding, flyers.</p>
                    </Link>
                    <Link href="/templates/new" className="rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-300 hover:shadow-sm">
                        <p className="font-medium text-zinc-900">{t.dash_create_template}</p>
                        <p className="mt-1 text-sm text-zinc-500">{t.dash_create_template_desc}</p>
                    </Link>
                </div>
            </div>

            <div className="mb-10">
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-400">Card types</h2>
                <div className="flex flex-wrap gap-2">
                    <Link href="/companies" className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:border-zinc-400">💼 Business cards</Link>
                    {DESIGN_KINDS.map((k) => (
                        <Link key={k.kind} href={`/designs/new?kind=${k.kind}`} className="rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm hover:border-zinc-400">
                            {k.emoji} {k.label}
                        </Link>
                    ))}
                </div>
            </div>

            <div className="grid gap-10 lg:grid-cols-2">
                <div>
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">{t.dash_recent_companies}</h2>
                        <Link href="/companies" className="text-sm text-zinc-500 hover:text-zinc-800">{t.dash_view_all}</Link>
                    </div>
                    {companies.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">{t.companies_empty}</p>
                    ) : (
                        <div className="grid gap-3">
                            {companies.map((company) => (
                                <Link key={company.id} href={`/companies/${company.id}`} className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm">
                                    {company.logo_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={company.logo_url} alt={company.name} className="h-10 w-10 rounded-lg object-contain" />
                                    ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100 text-sm font-semibold text-zinc-500">{company.name[0]}</div>
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-medium text-zinc-900">{company.name}</p>
                                        <p className="text-sm text-zinc-500">{company.people_count ?? 0} people{company.domain ? ` · ${company.domain}` : ""}</p>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                <div className="space-y-10">
                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Recent print runs</h2>
                            <Link href="/print" className="text-sm text-zinc-500 hover:text-zinc-800">{t.dash_view_all}</Link>
                        </div>
                        {printJobs.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-500">No print runs yet.</p>
                        ) : (
                            <div className="grid gap-3">
                                {printJobs.map((job) => (
                                    <Link key={job.id} href={`/print/${job.id}`} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-zinc-900">{job.name}</p>
                                            <p className="text-sm text-zinc-500">{job.card_count} cards · {job.paper} {job.orientation}{job.page_count ? ` · ${job.page_count} pages` : ""}</p>
                                        </div>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[job.status]}`}>{job.status}</span>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {(designs.length > 0 || templates.length > 0) && (
                        <div>
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Recent designs</h2>
                                <Link href="/designs" className="text-sm text-zinc-500 hover:text-zinc-800">{t.dash_view_all}</Link>
                            </div>
                            <div className="grid gap-3">
                                {designs.map((d) => (
                                    <Link key={d.id} href={`/designs/${d.id}`} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-zinc-900">{d.name}</p>
                                            <p className="text-sm text-zinc-500">{getKind(d.kind).emoji} {getKind(d.kind).label}</p>
                                        </div>
                                        <span className="text-sm text-zinc-400">{t.companies_edit}</span>
                                    </Link>
                                ))}
                                {templates.map((template) => (
                                    <Link key={template.id} href={`/templates/${template.id}/edit`} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm">
                                        <div className="min-w-0">
                                            <p className="truncate font-medium text-zinc-900">{template.name}</p>
                                            <p className="text-sm text-zinc-500">Template · {getKind(template.kind).label} · {template.width_mm}×{template.height_mm} mm</p>
                                        </div>
                                        <span className="text-sm text-zinc-400">{t.companies_edit}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

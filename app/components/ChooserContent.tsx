"use client";

import Link from "next/link";
import { RESUME_APP } from "@/lib/base-path";

/**
 * Shown straight after signing in: pick the thing you came to do.
 *
 * Both products live on one domain — Reactive Resume owns the root
 * (/dashboard, /builder/...), the cards app is mounted under /cards. Links to
 * the resume side are plain <a> on purpose: <Link> would prefix them with the
 * cards base path.
 */
export default function ChooserContent({ name }: { name: string }) {
    return (
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-16">
            <div className="mb-10 text-center">
                <h1 className="text-3xl font-bold tracking-tight text-[#1A1128]">Welcome back, {name}</h1>
                <p className="mt-2 text-[#4A3B5C]/80">What would you like to do today?</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
                <a
                    href={RESUME_APP.dashboard}
                    className="group rounded-2xl border-2 border-zinc-200 bg-white p-7 transition hover:border-[#1A1128] hover:shadow-lg"
                >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#1A1128]/5 text-2xl">📄</div>
                    <h2 className="text-lg font-semibold text-[#1A1128]">Create a CV</h2>
                    <p className="mt-1.5 text-sm text-[#4A3B5C]/80">
                        Build and edit resumes, write cover letters, check them against ATS, and export to PDF or Word.
                    </p>
                    <span className="mt-4 inline-block text-sm font-medium text-[#1A1128] group-hover:underline">
                        Open the CV builder →
                    </span>
                </a>

                <Link
                    href="/"
                    className="group rounded-2xl border-2 border-zinc-200 bg-white p-7 transition hover:border-[#FF6B35] hover:shadow-lg"
                >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#FF6B35]/10 text-2xl">🖨️</div>
                    <h2 className="text-lg font-semibold text-[#1A1128]">Design &amp; print cards</h2>
                    <p className="mt-1.5 text-sm text-[#4A3B5C]/80">
                        Business cards, flyers, harambee, birthday and wedding cards — laid out on A4 sheets, priced and printed.
                    </p>
                    <span className="mt-4 inline-block text-sm font-medium text-[#FF6B35] group-hover:underline">
                        Open Cards &amp; Print →
                    </span>
                </Link>
            </div>

            <p className="mt-8 text-center text-xs text-[#4A3B5C]/50">
                You stay signed in across both — switch any time from the menu.
            </p>
        </div>
    );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";

/** Friendlier replacement for Next's bare "This page couldn't load". */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error("[cards] page error:", error);
    }, [error]);

    return (
        <div className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-20 text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">⚠️</div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1A1128]">Something went wrong</h1>
            <p className="mt-2 text-sm text-[#4A3B5C]/80">
                This page couldn&apos;t load. The CVPAP API may be restarting or unreachable — try again in a moment.
            </p>
            {error.digest && <p className="mt-2 text-xs text-zinc-400">Reference: {error.digest}</p>}
            <div className="mt-6 flex items-center gap-3">
                <button onClick={reset} className="rounded-lg bg-[#FF6B35] px-5 py-2 text-sm font-semibold text-white hover:bg-[#e55a2a]">
                    Try again
                </button>
                <Link href="/" className="rounded-lg border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    Dashboard
                </Link>
            </div>
        </div>
    );
}

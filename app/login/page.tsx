"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "../components/I18nProvider";
import { withBase } from "@/lib/base-path";

const CVPAP_DASHBOARD_URL = process.env.NEXT_PUBLIC_CVPAP_DASHBOARD_URL ?? "https://ajiriwa.gidraf.dev";

function LoginForm() {
    const router = useRouter();
    const params = useSearchParams();
    const { t } = useTranslation();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(() => {
        const e = params.get("error");
        if (e === "sso_failed") return "Single sign-on failed — please sign in with your CVPAP email and password.";
        if (e === "missing_token") return "Single sign-on link was incomplete — please sign in below.";
        if (params.get("expired")) return "Your session expired. Please sign in again.";
        return null;
    });
    const [submitting, setSubmitting] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !password) return;
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(withBase("/api/auth/login"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string };
            if (!res.ok) {
                setError(body.error ?? "Sign-in failed");
                return;
            }
            const next = params.get("next");
            // no explicit destination → let them pick CV or cards
            router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/choose");
            router.refresh();
        } catch {
            setError("Could not reach the server. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="rounded-2xl border border-[#1A1128]/8 bg-white p-6 shadow-sm">
            {error && (
                <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label className="mb-1 block text-xs font-medium text-[#4A3B5C]/70" htmlFor="email">Email</label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="username"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@business.co.ke"
                        required
                        className="w-full rounded-xl border border-[#1A1128]/10 bg-[#FFF4E6]/50 px-4 py-3 text-sm text-[#1A1128] outline-none transition placeholder:text-[#4A3B5C]/40 focus:border-[#FF6B35] focus:bg-white focus:ring-2 focus:ring-[#FF6B35]/15"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs font-medium text-[#4A3B5C]/70" htmlFor="password">Password</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full rounded-xl border border-[#1A1128]/10 bg-[#FFF4E6]/50 px-4 py-3 text-sm text-[#1A1128] outline-none transition placeholder:text-[#4A3B5C]/40 focus:border-[#FF6B35] focus:bg-white focus:ring-2 focus:ring-[#FF6B35]/15"
                    />
                </div>
                <button
                    type="submit"
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF6B35] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#e55a2a] hover:shadow-md hover:shadow-[#FF6B35]/20 disabled:opacity-50"
                >
                    {submitting ? "Signing in…" : t.nav_sign_in}
                </button>
            </form>

            <div className="mt-5 flex items-center justify-between text-xs">
                <a href={`${CVPAP_DASHBOARD_URL}/auth/reset-password`} className="font-medium text-[#FF6B35] hover:underline">
                    Forgot password?
                </a>
                <a href={CVPAP_DASHBOARD_URL} className="text-[#4A3B5C]/60 hover:text-[#1A1128]">
                    Open CVPAP dashboard →
                </a>
            </div>
        </div>
    );
}

export default function LoginPage() {
    const { t } = useTranslation();

    return (
        <div className="flex flex-1">
            {/* Left — branding panel */}
            <div className="relative hidden overflow-hidden bg-[#1A1128] lg:flex lg:w-[45%]">
                <div className="absolute inset-0 opacity-[0.04]" style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                }} />
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#1A1128] to-transparent" />
                <div className="absolute right-[-60px] top-[15%] rotate-12 opacity-10">
                    <div className="h-[180px] w-[300px] rounded-2xl border-2 border-[#C4B5FD] bg-[#C4B5FD]/10" />
                </div>
                <div className="absolute right-[-30px] top-[20%] rotate-6 opacity-15">
                    <div className="h-[180px] w-[300px] rounded-2xl border-2 border-[#FF6B35] bg-[#FF6B35]/10" />
                </div>

                <div className="relative z-10 flex flex-col justify-between p-12">
                    <div className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={withBase("/icon.svg")} alt="Cards & Print" className="h-9 w-9" />
                        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 22 }}>
                            <span className="italic text-[#FF6B35]">Cards</span>
                            <span className="text-white"> & Print</span>
                        </span>
                    </div>

                    <div className="space-y-8">
                        <h2 className="text-3xl font-bold leading-tight text-white" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            {t.login_quote}
                        </h2>
                        <div className="h-px bg-gradient-to-r from-[#FF6B35]/40 via-[#C4B5FD]/40 to-transparent" />
                        <div className="grid grid-cols-3 gap-5">
                            <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                                <p className="text-xl font-bold text-[#FF6B35]">A4 · A3</p>
                                <p className="mt-0.5 text-xs text-zinc-400">Print-ready sheets</p>
                            </div>
                            <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                                <p className="text-xl font-bold text-[#C4B5FD]">PDF</p>
                                <p className="mt-0.5 text-xs text-zinc-400">Save or print directly</p>
                            </div>
                            <div className="rounded-xl bg-white/5 p-4 backdrop-blur-sm">
                                <p className="text-xl font-bold text-[#86EFAC]">2-sided</p>
                                <p className="mt-0.5 text-xs text-zinc-400">Front & back designs</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {["Business cards", "Flyers", "Harambee cards", "Birthday", "Baby shower", "Wedding", "Events"].map((tag) => (
                            <span key={tag} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right — sign in */}
            <div className="flex flex-1 flex-col items-center justify-center bg-[#FFF4E6] px-6 py-12">
                <div className="w-full max-w-[380px]">
                    <div className="mb-10 flex items-center justify-center gap-2.5 lg:hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={withBase("/icon.svg")} alt="Cards & Print" className="h-10 w-10" />
                        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 24 }}>
                            <span className="italic text-[#FF6B35]">Cards</span>
                            <span className="text-[#1A1128]"> & Print</span>
                        </span>
                    </div>

                    <div className="mb-8">
                        <h1 className="text-2xl font-bold tracking-tight text-[#1A1128]" style={{ fontFamily: "'Bricolage Grotesque', sans-serif" }}>
                            {t.login_title}
                        </h1>
                        <p className="mt-2 text-sm text-[#4A3B5C]/70">Use your CVPAP partner account — the same email and password as the CVPAP dashboard.</p>
                    </div>

                    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-white" />}>
                        <LoginForm />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}

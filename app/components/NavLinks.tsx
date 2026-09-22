"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "./I18nProvider";

export const NAV_ITEMS = [
    { href: "/", key: "nav_dashboard" as const, match: (p: string) => p === "/" },
    { href: "/companies", key: "nav_companies" as const, match: (p: string) => p.startsWith("/companies") },
    { href: "/designs", key: "nav_designs" as const, match: (p: string) => p.startsWith("/designs") },
    { href: "/templates", key: "nav_templates" as const, match: (p: string) => p.startsWith("/templates") },
    { href: "/print", key: "nav_print" as const, match: (p: string) => p.startsWith("/print") },
    { href: "/reports", key: "nav_reports" as const, match: (p: string) => p.startsWith("/reports") || p.startsWith("/settings") },
];

export default function NavLinks() {
    const { t } = useTranslation();
    const pathname = usePathname();

    return (
        <div className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
                const active = item.match(pathname);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${active ? "bg-[#1A1128] text-white" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"}`}
                    >
                        {t[item.key]}
                    </Link>
                );
            })}
        </div>
    );
}

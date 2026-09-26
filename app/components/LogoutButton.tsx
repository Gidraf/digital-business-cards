"use client";

import { useTranslation } from "./I18nProvider";
import { RESUME_APP, withBase } from "@/lib/base-path";

export default function LogoutButton() {
    const { t } = useTranslation();

    async function handleLogout() {
        await fetch(withBase("/api/auth/logout"), { method: "POST" }).catch(() => undefined);
        // also ends the CV-side session, then lands back on the single login page
        window.location.href = RESUME_APP.logout;
    }

    return (
        <button
            onClick={handleLogout}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
            {t.nav_sign_out}
        </button>
    );
}

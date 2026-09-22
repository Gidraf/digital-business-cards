"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, ApiError } from "@/lib/api";
import { useTranslation } from "./I18nProvider";

interface UseTemplateButtonProps {
    templateId: string;
    name: string;
}

/** Copies a built-in (read-only) template into the partner's library and opens it. */
export default function UseTemplateButton({ templateId, name }: UseTemplateButtonProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const [busy, setBusy] = useState(false);

    async function handleUse() {
        setBusy(true);
        try {
            const copy = await clientApi().duplicateTemplate(templateId, name);
            router.push(`/templates/${copy.id}/edit`);
        } catch (err) {
            alert(err instanceof ApiError ? err.message : "Could not copy template");
            setBusy(false);
        }
    }

    return (
        <button
            onClick={handleUse}
            disabled={busy}
            className="w-full rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
        >
            {busy ? "Copying…" : t.templates_use}
        </button>
    );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, ApiError } from "@/lib/api";
import { useTranslation } from "./I18nProvider";
import ConfirmModal from "./ConfirmModal";

interface DeleteTemplateButtonProps {
    templateId: string;
    templateName: string;
}

export default function DeleteTemplateButton({ templateId, templateName }: DeleteTemplateButtonProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const [showConfirm, setShowConfirm] = useState(false);

    async function handleDelete() {
        try {
            await clientApi().deleteTemplate(templateId);
        } catch (err) {
            alert(err instanceof ApiError ? err.message : "Could not delete template");
            return;
        }

        setShowConfirm(false);
        router.refresh();
    }

    return (
        <>
            <button
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowConfirm(true);
                }}
                className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-50 hover:text-red-600"
            >
                {t.modal_delete}
            </button>
            {showConfirm && (
                <ConfirmModal
                    title={t.modal_delete}
                    message={`Are you sure you want to delete "${templateName}"? This cannot be undone.`}
                    confirmLabel={t.modal_delete}
                    destructive
                    onConfirm={handleDelete}
                    onCancel={() => setShowConfirm(false)}
                />
            )}
        </>
    );
}

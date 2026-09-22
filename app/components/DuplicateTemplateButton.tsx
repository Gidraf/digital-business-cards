"use client";

import { useRouter } from "next/navigation";
import { clientApi, ApiError } from "@/lib/api";
import { useToast } from "./ToastProvider";

interface DuplicateTemplateButtonProps {
    templateId: string;
    templateName: string;
}

export default function DuplicateTemplateButton({ templateId, templateName }: DuplicateTemplateButtonProps) {
    const router = useRouter();
    const { toast } = useToast();

    async function handleDuplicate(e: React.MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        try {
            await clientApi().duplicateTemplate(templateId, `${templateName} (Copy)`);
        } catch (err) {
            toast(err instanceof ApiError ? err.message : "Could not duplicate", "error");
            return;
        }
        toast("Template duplicated");
        router.refresh();
    }

    return (
        <button
            onClick={handleDuplicate}
            className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            title="Duplicate"
        >
            Duplicate
        </button>
    );
}

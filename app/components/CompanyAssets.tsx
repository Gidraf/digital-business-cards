"use client";

import { useState, useEffect, useRef } from "react";
import { clientApi } from "@/lib/api";
import type { Asset } from "@/lib/types";
import { useTranslation } from "./I18nProvider";
import ConfirmModal from "./ConfirmModal";
import DropZone from "./DropZone";

interface CompanyAssetsProps {
    /** omit for the partner-wide (shared) library */
    companyId?: string | null;
}

export default function CompanyAssets({ companyId }: CompanyAssetsProps) {
    const { t } = useTranslation();
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [deleteAsset, setDeleteAsset] = useState<Asset | null>(null);

    const loadAssetsRef = useRef<(() => Promise<void>) | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        loadAssetsRef.current = async () => {
            try {
                const list = await clientApi().listAssets(companyId ?? null);
                if (!cancelled) setAssets(list);
            } catch { /* keep previous list */ }
            if (!cancelled) setLoading(false);
        };
        loadAssetsRef.current();
        return () => { cancelled = true; };
    }, [companyId]);

    async function handleUpload(files: File[]) {
        setUploading(true);
        try {
            await clientApi().uploadAssets(files, companyId ?? null);
            await loadAssetsRef.current?.();
        } finally {
            setUploading(false);
        }
    }

    async function handleDelete() {
        if (!deleteAsset) return;
        await clientApi().deleteAsset(deleteAsset.id);
        setDeleteAsset(null);
        await loadAssetsRef.current?.();
    }

    return (
        <div className="mb-8">
            <div className="mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Assets</h2>
                <p className="mt-1 text-sm text-zinc-500">
                    Images you can use in your templates (logos, backgrounds, icons).
                </p>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-24 animate-pulse rounded-lg bg-zinc-200" />
                    ))}
                </div>
            ) : (
                <>
                    {assets.length > 0 && (
                        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {assets.map((asset) => (
                                <div
                                    key={asset.id}
                                    className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white"
                                >
                                    <div className="flex h-24 items-center justify-center bg-zinc-50 p-2">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={asset.url ?? ""}
                                            alt={asset.name}
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    </div>
                                    <div className="flex items-center justify-between px-2 py-1.5">
                                        <span className="truncate text-xs text-zinc-600">{asset.name}</span>
                                        <button
                                            onClick={() => setDeleteAsset(asset)}
                                            className="hidden shrink-0 text-xs text-zinc-400 hover:text-red-500 group-hover:block"
                                        >
                                            &times;
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <DropZone
                        onFiles={handleUpload}
                        multiple
                        disabled={uploading}
                    >
                        <div className="flex flex-col items-center gap-2 py-4">
                            <svg className="h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <p className="text-sm text-zinc-500">
                                {uploading ? "Uploading..." : "Drag & drop images here, or click to browse"}
                            </p>
                        </div>
                    </DropZone>
                </>
            )}

            {deleteAsset && (
                <ConfirmModal
                    title={t.modal_delete}
                    message={`Delete "${deleteAsset.name}"? Templates using this image will show a placeholder instead.`}
                    confirmLabel={t.modal_delete}
                    destructive
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteAsset(null)}
                />
            )}
        </div>
    );
}

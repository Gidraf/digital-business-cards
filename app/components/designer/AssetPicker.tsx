"use client";

import { useState, useEffect, useRef } from "react";
import { clientApi } from "@/lib/api";
import type { Asset } from "@/lib/types";
import LogoBuilder from "../LogoBuilder";

interface AssetPickerProps {
    /** scope the library to a company (shared assets are always included) */
    companyId?: string | null;
    currentSource?: string;
    onSelect: (source: string) => void;
    /** labels for the built-in data-driven sources of the current card kind */
    imageSlots?: { key: "logo" | "photo"; label: string }[];
    /** notify parent so the canvas can preview the new asset immediately */
    onAssetUrl?: (id: string, url: string) => void;
}

export default function AssetPicker({ companyId, currentSource, onSelect, imageSlots, onAssetUrl }: AssetPickerProps) {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [showBuilder, setShowBuilder] = useState(false);
    const loadAssetsRef = useRef<(() => Promise<void>) | undefined>(undefined);

    useEffect(() => {
        let cancelled = false;
        loadAssetsRef.current = async () => {
            setLoading(true);
            try {
                const list = await clientApi().listAssets(companyId ?? null);
                if (!cancelled) {
                    setAssets(list);
                    for (const a of list) if (a.url) onAssetUrl?.(a.id, a.url);
                }
            } catch { /* ignore */ }
            if (!cancelled) setLoading(false);
        };
        loadAssetsRef.current();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyId]);

    async function addFile(file: File) {
        setUploading(true);
        try {
            const [created] = await clientApi().uploadAssets([file], companyId ?? null);
            await loadAssetsRef.current?.();
            if (created) {
                if (created.url) onAssetUrl?.(created.id, created.url);
                onSelect(`asset:${created.id}`);
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : "Upload failed");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) await addFile(file);
    }

    async function handleDelete(asset: Asset) {
        await clientApi().deleteAsset(asset.id);
        await loadAssetsRef.current?.();
        if (currentSource === `asset:${asset.id}`) {
            onSelect(imageSlots?.[0]?.key ?? "logo");
        }
    }

    const slots = imageSlots ?? [{ key: "logo", label: "Company logo" }, { key: "photo", label: "Person photo" }];

    return (
        <div className="space-y-2">
            <label className="mb-1 block text-xs font-medium text-zinc-500">Source</label>

            {/* Data-driven sources */}
            <div className="flex gap-1">
                {slots.map((slot) => (
                    <button
                        key={slot.key}
                        type="button"
                        onClick={() => onSelect(slot.key)}
                        className={`flex-1 rounded px-2 py-1 text-xs ${currentSource === slot.key ? "bg-zinc-900 text-white" : "bg-zinc-100 hover:bg-zinc-200"}`}
                    >
                        {slot.label}
                    </button>
                ))}
            </div>

            {/* Asset list */}
            {loading ? (
                <p className="text-xs text-zinc-400">Loading assets...</p>
            ) : assets.length > 0 ? (
                <div className="max-h-36 space-y-1 overflow-y-auto">
                    {assets.map((asset) => (
                        <div
                            key={asset.id}
                            className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs ${
                                currentSource === `asset:${asset.id}`
                                    ? "border-sky-400 bg-sky-50"
                                    : "border-zinc-200 hover:bg-zinc-50"
                            }`}
                        >
                            {asset.url && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={asset.url} alt="" className="h-6 w-6 rounded object-contain" />
                            )}
                            <button
                                type="button"
                                onClick={() => onSelect(`asset:${asset.id}`)}
                                className="flex-1 truncate text-left"
                                title={asset.name}
                            >
                                {asset.name}{!asset.company_id && <span className="ml-1 text-[10px] text-zinc-400">shared</span>}
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDelete(asset)}
                                className="text-zinc-400 hover:text-red-500"
                            >
                                &times;
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-zinc-400">No assets uploaded yet</p>
            )}

            {/* Generate */}
            <button
                type="button"
                onClick={() => setShowBuilder(true)}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-[#FF6B35]/50 bg-[#FF6B35]/5 px-3 py-2 text-xs font-medium text-[#FF6B35] hover:bg-[#FF6B35]/10"
            >
                ✨ Generate logo / artwork
            </button>

            {/* Upload */}
            <label className="flex cursor-pointer items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 transition hover:border-zinc-400 hover:bg-zinc-50">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {uploading ? "Uploading..." : "Upload image"}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUpload}
                    className="hidden"
                    disabled={uploading}
                />
            </label>

            {showBuilder && (
                <LogoBuilder
                    onPick={async (file) => {
                        setShowBuilder(false);
                        await addFile(file);
                    }}
                    onClose={() => setShowBuilder(false)}
                />
            )}
        </div>
    );
}

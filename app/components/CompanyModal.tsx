"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, ApiError } from "@/lib/api";
import { useTranslation } from "./I18nProvider";
import ImageUpload from "./ImageUpload";
import LogoBuilder from "./LogoBuilder";
import { svgDataUri } from "@/lib/logo-builder";

interface CompanyProps {
    onClose: () => void;
    id?: string;
    name: string;
    domain: string;
    website: string;
    address: string;
    logo: File | null;
    currentLogoUrl?: string | null;
}

export function CompanyModal(props: CompanyProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const [name, setName] = useState(props.name);
    const [domain, setDomain] = useState(props.domain);
    const [website, setWebsite] = useState(props.website);
    const [address, setAddress] = useState(props.address);
    const [logo, setLogo] = useState<File | null>(null);
    const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
    const [showBuilder, setShowBuilder] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const isEdit = !!props.id;

    async function handleSubmit(e: React.SyntheticEvent) {
        e.preventDefault();
        setError(null);
        setSaving(true);
        const api = clientApi();
        try {
            const body = { name, domain, website, address };
            const company = isEdit && props.id
                ? await api.updateCompany(props.id, body)
                : await api.createCompany(body);
            if (logo) {
                await api.uploadLogo(company.id, logo, logo.name);
            }
            props.onClose();
            router.refresh();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Could not save company");
        } finally {
            setSaving(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 backdrop-blur-sm"
            onClick={props.onClose}
        >
            <div
                className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-2xl sm:p-8"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-6 flex items-center justify-between">
                    <h2 className="text-xl font-semibold">
                        {isEdit ? t.companies_edit : t.companies_add}
                    </h2>
                    <button
                        onClick={props.onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                    >
                        &times;
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700">
                            {t.form_company_name}
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Acme Inc."
                            required
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700">
                            {t.form_domain}
                        </label>
                        <input
                            type="text"
                            value={domain}
                            onChange={(e) => setDomain(e.target.value)}
                            placeholder="acme.com"
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700">
                            {t.form_website}
                        </label>
                        <input
                            type="url"
                            value={website}
                            onChange={(e) => setWebsite(e.target.value)}
                            placeholder="https://acme.com"
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        />
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-zinc-700">
                            {t.form_address}
                            <span className="ml-1 text-xs font-normal text-zinc-400">({t.form_address_hint})</span>
                        </label>
                        <input
                            type="text"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            placeholder="Hauptstraße 1, 1010 Wien"
                            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                        />
                    </div>

                    <ImageUpload
                        label={t.form_logo}
                        onImageReady={(file) => { setLogo(file); setGeneratedLogo(null); }}
                        currentImageUrl={generatedLogo ?? props.currentLogoUrl}
                        allowSkipCrop
                    />

                    <button
                        type="button"
                        onClick={() => setShowBuilder(true)}
                        className="w-full rounded-lg border border-dashed border-[#FF6B35]/50 bg-[#FF6B35]/5 px-4 py-2.5 text-sm font-medium text-[#FF6B35] hover:bg-[#FF6B35]/10"
                    >
                        ✨ No logo? Generate one from the name
                    </button>

                    {error && <p className="text-sm text-red-500">{error}</p>}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={props.onClose}
                            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                        >
                            {t.modal_cancel}
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
                        >
                            {saving ? "Saving…" : isEdit ? t.modal_save : t.companies_add}
                        </button>
                    </div>
                </form>
            </div>

            {showBuilder && (
                <LogoBuilder
                    defaultName={name}
                    onPick={(file, svg) => {
                        setLogo(file);
                        setGeneratedLogo(svgDataUri(svg));
                        setShowBuilder(false);
                    }}
                    onClose={() => setShowBuilder(false)}
                />
            )}
        </div>
    );
}

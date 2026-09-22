"use client";

import Link from "next/link";
import { useTranslation } from "./I18nProvider";
import PeopleList from "./PeopleList";
import DeleteCompanyButton from "./DeleteCompanyButton";
import EditCompanyButton from "./EditCompanyButton";
import CustomFieldsManager from "./CustomFieldsManager";
import CompanyAssets from "./CompanyAssets";

import type { CardTemplate, Company, Person } from "@/lib/types";

interface CompanyDetailContentProps {
    company: Company;
    people: Person[];
    templates: CardTemplate[];
}

export default function CompanyDetailContent({ company, people, templates }: CompanyDetailContentProps) {
    const logoUrl = company.logo_url;
    const { t } = useTranslation();

    return (
        <div className="mx-auto w-full max-w-4xl px-6 py-10">
            {/* Breadcrumb */}
            <div className="mb-6 flex items-center gap-2 text-sm text-zinc-500">
                <Link href="/companies" className="hover:text-zinc-800">{t.companies_title}</Link>
                <span>/</span>
                <span className="text-zinc-900">{company.name}</span>
            </div>

            {/* Company header */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-5">
                    {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoUrl} alt={company.name} className="h-14 w-14 rounded-xl object-contain" />
                    ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-zinc-100 text-xl font-bold text-zinc-400">
                            {company.name[0]}
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{company.name}</h1>
                        <div className="flex items-center gap-3 text-sm text-zinc-500">
                            {company.domain && <span>{company.domain}</span>}
                            {company.website && (
                                <>
                                    {company.domain && <span>·</span>}
                                    <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
                                        {company.website.replace(/^https?:\/\//, "")}
                                    </a>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Link href={`/print/new?company=${company.id}`} className="rounded-lg bg-[#FF6B35] px-3 py-2 text-sm font-medium text-white hover:bg-[#e55a2a]">
                        🖨️ Print cards
                    </Link>
                    <EditCompanyButton
                        id={company.id}
                        name={company.name}
                        domain={company.domain ?? ""}
                        website={company.website ?? ""}
                        address={company.address ?? ""}
                        logoUrl={logoUrl}
                    />
                    <DeleteCompanyButton companyId={company.id} companyName={company.name} />
                </div>
            </div>

            <CompanyAssets companyId={company.id} />
            <CustomFieldsManager
                companyId={company.id}
                initialDefs={company.custom_field_definitions ?? []}
            />

            <PeopleList
                people={people}
                companyId={company.id}
                templates={templates}
                companyName={company.name}
                companyLogoUrl={logoUrl}
                companyAddress={company.address ?? ""}
                customFieldDefs={company.custom_field_definitions ?? []}
            />
        </div>
    );
}

import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api-server";
import { ApiError } from "@/lib/api";
import CompanyDetailContent from "@/app/components/CompanyDetailContent";

export default async function CompanyDetailPage(props: PageProps<"/companies/[id]">) {
    const { id } = await props.params;
    const { api } = await serverApi();

    let company, people;
    try {
        ({ company, people } = await api.getCompany(id));
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) notFound();
        throw e;
    }
    const templates = await api.listTemplates("business_card", false);

    return <CompanyDetailContent company={company} people={people} templates={templates} />;
}

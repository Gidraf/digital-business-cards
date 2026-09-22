import { notFound } from "next/navigation";
import { serverApi } from "@/lib/api-server";
import { ApiError } from "@/lib/api";
import PrintStudio from "@/app/components/print/PrintStudio";

export default async function PrintJobPage(props: PageProps<"/print/[id]">) {
    const { id } = await props.params;
    const { api } = await serverApi();
    let job;
    try {
        job = await api.getPrintJob(id);
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) notFound();
        throw e;
    }
    const [companies, people, designs, templates, pricingRes] = await Promise.all([
        api.listCompanies(), api.listPeople(), api.listDesigns(), api.listTemplates(undefined, true), api.getPricing(),
    ]);
    return <PrintStudio job={job} pricing={pricingRes.pricing} companies={companies} people={people} designs={designs} templates={templates} />;
}

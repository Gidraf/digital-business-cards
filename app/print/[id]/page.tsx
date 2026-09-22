import { notFound } from "next/navigation";
import { safeApi, safeValue, serverApi } from "@/lib/api-server";
import { ApiError } from "@/lib/api";
import { DEFAULT_PRICING } from "@/lib/pricing";
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
    const [companies, people, designs, templates, pricing] = await Promise.all([
        safeValue(api.listCompanies(), [], "listCompanies"),
        safeValue(api.listPeople(), [], "listPeople"),
        safeValue(api.listDesigns(), [], "listDesigns"),
        safeValue(api.listTemplates(undefined, true), [], "listTemplates"),
        safeApi(api.getPricing(), { pricing: DEFAULT_PRICING, defaults: DEFAULT_PRICING }, "getPricing"),
    ]);
    return (
        <PrintStudio
            job={job}
            pricing={pricing.data.pricing}
            pricingFallback={!pricing.ok}
            companies={companies}
            people={people}
            designs={designs}
            templates={templates}
        />
    );
}

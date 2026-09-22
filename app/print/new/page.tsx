import { safeApi, safeValue, serverApi } from "@/lib/api-server";
import { DEFAULT_PRICING } from "@/lib/pricing";
import PrintStudio from "@/app/components/print/PrintStudio";

export default async function NewPrintPage(props: PageProps<"/print/new">) {
    const params = await props.searchParams;
    const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
    const { api } = await serverApi();
    const [companies, people, designs, templates, pricing] = await Promise.all([
        safeValue(api.listCompanies(), [], "listCompanies"),
        safeValue(api.listPeople(), [], "listPeople"),
        safeValue(api.listDesigns(), [], "listDesigns"),
        safeValue(api.listTemplates(undefined, true), [], "listTemplates"),
        safeApi(api.getPricing(), { pricing: DEFAULT_PRICING, defaults: DEFAULT_PRICING }, "getPricing"),
    ]);
    return (
        <PrintStudio
            pricing={pricing.data.pricing}
            pricingFallback={!pricing.ok}
            companies={companies}
            people={people}
            designs={designs}
            templates={templates}
            seed={{ company: str(params.company), person: str(params.person), design: str(params.design) }}
        />
    );
}

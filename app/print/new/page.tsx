import { serverApi } from "@/lib/api-server";
import PrintStudio from "@/app/components/print/PrintStudio";

export default async function NewPrintPage(props: PageProps<"/print/new">) {
    const params = await props.searchParams;
    const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
    const { api } = await serverApi();
    const [companies, people, designs, templates, pricingRes] = await Promise.all([
        api.listCompanies(), api.listPeople(), api.listDesigns(), api.listTemplates(undefined, true), api.getPricing(),
    ]);
    return (
        <PrintStudio
            pricing={pricingRes.pricing}
            companies={companies}
            people={people}
            designs={designs}
            templates={templates}
            seed={{ company: str(params.company), person: str(params.person), design: str(params.design) }}
        />
    );
}

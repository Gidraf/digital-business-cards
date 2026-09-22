import { serverApi } from "@/lib/api-server";
import PrintStudio from "@/app/components/print/PrintStudio";

export default async function NewPrintPage(props: PageProps<"/print/new">) {
    const params = await props.searchParams;
    const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
    const { api } = await serverApi();
    const [companies, people, designs, templates] = await Promise.all([
        api.listCompanies(), api.listPeople(), api.listDesigns(), api.listTemplates(undefined, true),
    ]);
    return (
        <PrintStudio
            companies={companies}
            people={people}
            designs={designs}
            templates={templates}
            seed={{ company: str(params.company), person: str(params.person), design: str(params.design) }}
        />
    );
}

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
    const [companies, people, designs, templates] = await Promise.all([
        api.listCompanies(), api.listPeople(), api.listDesigns(), api.listTemplates(undefined, true),
    ]);
    return <PrintStudio job={job} companies={companies} people={people} designs={designs} templates={templates} />;
}

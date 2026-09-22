import { safeValue, serverApi } from "@/lib/api-server";
import DashboardContent from "./components/DashboardContent";

export default async function Home() {
    const { api, session } = await serverApi();
    const [summary, companies, templates, designs, printJobs] = await Promise.all([
        safeValue(api.summary(), { companies: 0, people: 0, templates: 0, builtin_templates: 0, designs: 0, print_jobs: 0 }, "summary"),
        safeValue(api.listCompanies(), [], "listCompanies"),
        safeValue(api.listTemplates(undefined, false), [], "listTemplates"),
        safeValue(api.listDesigns(), [], "listDesigns"),
        safeValue(api.listPrintJobs(), [], "listPrintJobs"),
    ]);

    return (
        <DashboardContent
            partnerName={session.partner?.name ?? session.user.name}
            summary={summary}
            companies={companies.slice(0, 6)}
            templates={templates.filter((t) => !t.is_builtin).slice(0, 6)}
            designs={designs.slice(0, 6)}
            printJobs={printJobs.slice(0, 5)}
        />
    );
}

import { serverApi } from "@/lib/api-server";
import DashboardContent from "./components/DashboardContent";

export default async function Home() {
    const { api, session } = await serverApi();
    const [summary, companies, templates, designs, printJobs] = await Promise.all([
        api.summary(),
        api.listCompanies(),
        api.listTemplates(undefined, false),
        api.listDesigns(),
        api.listPrintJobs(),
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

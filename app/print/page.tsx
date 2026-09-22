import { safeValue, serverApi } from "@/lib/api-server";
import PrintJobsContent from "@/app/components/PrintJobsContent";

export default async function PrintPage() {
    const { api } = await serverApi();
    const jobs = await safeValue(api.listPrintJobs(), [], "listPrintJobs");
    return <PrintJobsContent jobs={jobs} />;
}

import { serverApi } from "@/lib/api-server";
import ReportsContent from "@/app/components/ReportsContent";

export default async function ReportsPage(props: PageProps<"/reports">) {
    const params = await props.searchParams;
    const from = typeof params.from === "string" ? params.from : undefined;
    const to = typeof params.to === "string" ? params.to : undefined;
    const { api } = await serverApi();
    const [report, pricing] = await Promise.all([api.reports(from, to), api.getPricing()]);
    return <ReportsContent report={report} currency={pricing.pricing.currency} />;
}

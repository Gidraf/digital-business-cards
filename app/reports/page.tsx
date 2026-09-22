import { safeApi, safeValue, serverApi } from "@/lib/api-server";
import { DEFAULT_PRICING } from "@/lib/pricing";
import type { Report } from "@/lib/types";
import ReportsContent from "@/app/components/ReportsContent";

function emptyReport(from: string, to: string): Report {
    return {
        from, to, days: [], by_kind: [], events: [],
        totals: {
            created_designs: 0, created_people: 0, created_templates: 0, created_jobs: 0,
            prints: 0, printed_cards: 0, printed_sheets: 0, revenue: 0,
        },
    };
}

export default async function ReportsPage(props: PageProps<"/reports">) {
    const params = await props.searchParams;
    const from = typeof params.from === "string" ? params.from : undefined;
    const to = typeof params.to === "string" ? params.to : undefined;

    const { api } = await serverApi();
    const [report, pricing] = await Promise.all([
        // on failure the range is left blank and ReportsContent fills in its own default
        safeApi(api.reports(from, to), emptyReport(from ?? "", to ?? ""), "reports"),
        safeValue(api.getPricing(), { pricing: DEFAULT_PRICING, defaults: DEFAULT_PRICING }, "getPricing"),
    ]);

    return (
        <ReportsContent
            report={report.data}
            currency={pricing.pricing.currency}
            unavailable={report.ok ? null : report.error}
        />
    );
}

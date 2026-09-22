import { serverApi } from "@/lib/api-server";
import PricingSettings from "@/app/components/PricingSettings";

export default async function PricingPage() {
    const { api } = await serverApi();
    const { pricing, defaults } = await api.getPricing();
    return <PricingSettings initial={pricing} defaults={defaults} />;
}

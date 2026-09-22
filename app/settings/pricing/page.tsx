import { safeApi, serverApi } from "@/lib/api-server";
import { DEFAULT_PRICING } from "@/lib/pricing";
import PricingSettings from "@/app/components/PricingSettings";

export default async function PricingPage() {
    const { api } = await serverApi();
    const res = await safeApi(api.getPricing(), { pricing: DEFAULT_PRICING, defaults: DEFAULT_PRICING }, "getPricing");
    return <PricingSettings initial={res.data.pricing} defaults={res.data.defaults} unavailable={res.ok ? null : res.error} />;
}

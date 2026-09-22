import { safeValue, serverApi } from "@/lib/api-server";
import CompaniesContent from "../components/CompaniesContent";

export default async function CompaniesPage() {
    const { api } = await serverApi();
    const companies = await safeValue(api.listCompanies(), [], "listCompanies");
    return <CompaniesContent companies={companies} />;
}

import { serverApi } from "@/lib/api-server";
import CompaniesContent from "../components/CompaniesContent";

export default async function CompaniesPage() {
    const { api } = await serverApi();
    const companies = await api.listCompanies();
    return <CompaniesContent companies={companies} />;
}

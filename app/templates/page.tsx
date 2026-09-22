import { safeValue, serverApi } from "@/lib/api-server";
import TemplatesContent from "@/app/components/TemplatesContent";

export default async function TemplatesPage(props: PageProps<"/templates">) {
    const params = await props.searchParams;
    const kind = typeof params.kind === "string" ? params.kind : undefined;
    const { api } = await serverApi();
    const templates = await safeValue(api.listTemplates(undefined, true), [], "listTemplates");
    return <TemplatesContent templates={templates} initialKind={kind} />;
}

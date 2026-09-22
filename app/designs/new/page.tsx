import { safeValue, serverApi } from "@/lib/api-server";
import { isCardKind } from "@/lib/card-kinds";
import DesignEditor from "@/app/components/DesignEditor";

export default async function NewDesignPage(props: PageProps<"/designs/new">) {
    const params = await props.searchParams;
    const kind = typeof params.kind === "string" && isCardKind(params.kind) && params.kind !== "business_card" ? params.kind : "event";
    const templateId = typeof params.template === "string" ? params.template : undefined;
    const { api } = await serverApi();
    const templates = await safeValue(api.listTemplates(kind, true), [], "listTemplates");
    return <DesignEditor kind={kind} templates={templates} initialTemplateId={templateId} />;
}

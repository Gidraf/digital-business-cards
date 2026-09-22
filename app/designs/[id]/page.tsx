import { notFound } from "next/navigation";
import { safeValue, serverApi } from "@/lib/api-server";
import { ApiError } from "@/lib/api";
import DesignEditor from "@/app/components/DesignEditor";

export default async function EditDesignPage(props: PageProps<"/designs/[id]">) {
    const { id } = await props.params;
    const { api } = await serverApi();
    let design;
    try {
        design = await api.getDesign(id);
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) notFound();
        throw e;
    }
    const templates = await safeValue(api.listTemplates(design.kind, true), [], "listTemplates");
    return <DesignEditor kind={design.kind} templates={templates} design={design} />;
}

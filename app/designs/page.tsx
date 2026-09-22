import { serverApi } from "@/lib/api-server";
import DesignsContent from "@/app/components/DesignsContent";

export default async function DesignsPage(props: PageProps<"/designs">) {
    const params = await props.searchParams;
    const kind = typeof params.kind === "string" ? params.kind : undefined;
    const { api } = await serverApi();
    const [designs, templates] = await Promise.all([api.listDesigns(), api.listTemplates(undefined, true)]);
    return <DesignsContent designs={designs} templates={templates} initialKind={kind} />;
}

import TemplateDesigner from "@/app/components/TemplateDesigner";
import { isCardKind } from "@/lib/card-kinds";

export default async function NewTemplatePage(props: PageProps<"/templates/new">) {
    const params = await props.searchParams;
    const kind = typeof params.kind === "string" && isCardKind(params.kind) ? params.kind : "business_card";
    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
            <h1 className="mb-6 text-2xl font-semibold">Create Template</h1>
            <TemplateDesigner initialKind={kind} />
        </div>
    );
}

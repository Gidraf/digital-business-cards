import { notFound, redirect } from "next/navigation";
import { serverApi } from "@/lib/api-server";
import { ApiError } from "@/lib/api";
import TemplateDesigner from "@/app/components/TemplateDesigner";

export default async function EditTemplatePage(props: PageProps<"/templates/[id]/edit">) {
    const { id } = await props.params;
    const { api } = await serverApi();

    let template;
    try {
        template = await api.getTemplate(id);
    } catch (e) {
        if (e instanceof ApiError && e.status === 404) notFound();
        throw e;
    }
    if (template.is_builtin) {
        // built-ins are read-only — make a copy to edit
        const copy = await api.duplicateTemplate(template.id);
        redirect(`/templates/${copy.id}/edit`);
    }

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
            <h1 className="mb-6 text-2xl font-semibold">Edit Template</h1>
            <TemplateDesigner template={template} />
        </div>
    );
}

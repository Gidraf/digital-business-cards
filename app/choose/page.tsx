import { serverApi } from "@/lib/api-server";
import ChooserContent from "@/app/components/ChooserContent";

export default async function ChoosePage() {
    const { session } = await serverApi();
    return <ChooserContent name={session.partner?.name ?? session.user.name} />;
}

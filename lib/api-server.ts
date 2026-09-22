/**
 * Server-component side of lib/api.ts: reads the session cookies and
 * returns an API client, or redirects to /login when there is none.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createApi, type Api } from "./api";
import { parseSession, SESSION_COOKIE, TOKEN_COOKIE, type Session } from "./auth";

export async function getServerSession(): Promise<{ token: string | null; session: Session | null }> {
    const store = await cookies();
    return {
        token: store.get(TOKEN_COOKIE)?.value ?? null,
        session: parseSession(store.get(SESSION_COOKIE)?.value),
    };
}

/** API for server components; redirects to /login if not signed in. */
export async function serverApi(): Promise<{ api: Api; session: Session }> {
    const { token, session } = await getServerSession();
    if (!token || !session) redirect("/login");
    return { api: createApi({ token, partnerId: session.partner_id }), session };
}

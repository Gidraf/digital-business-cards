/**
 * Server-component side of lib/api.ts: reads the session cookies and
 * returns an API client, or redirects to /login when there is none.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ApiError, createApi, type Api } from "./api";
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

/**
 * Await an API call without letting one failure take the whole page down
 * (Next renders "This page couldn't load" for any thrown server error).
 *
 *  - 401 → the token expired: send the user to /login.
 *  - anything else (API down, endpoint missing after a partial deploy, 5xx)
 *    → log it and fall back, so the page still renders.
 *
 * `ok` tells the page whether the data is real or a fallback.
 */
export async function safeApi<T>(
    promise: Promise<T>,
    fallback: T,
    label: string,
): Promise<{ data: T; ok: boolean; error: string | null }> {
    try {
        return { data: await promise, ok: true, error: null };
    } catch (err) {
        if (err instanceof ApiError && err.status === 401) redirect("/login?expired=1");
        const message = err instanceof ApiError
            ? `${err.status} ${err.message}${err.code ? ` (${err.code})` : ""}`
            : err instanceof Error ? err.message : String(err);
        console.error(`[cards] ${label} failed: ${message}`);
        return { data: fallback, ok: false, error: message };
    }
}

/** Same, when only the value matters. */
export async function safeValue<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
    return (await safeApi(promise, fallback, label)).data;
}

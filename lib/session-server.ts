/**
 * Shared by the auth route handlers: turn a CVPAP JWT into our session
 * cookies. Validates the token against CVPAP first (also resolves the
 * partner the token acts for).
 */
import { NextResponse } from "next/server";
import { apiBase } from "./api";
import { cookieOptions, SESSION_COOKIE, serializeSession, TOKEN_COOKIE, type Session } from "./auth";

export async function resolveSession(token: string, partnerId?: string | null): Promise<Session | null> {
    const res = await fetch(`${apiBase()}/api/v1/cards/me${partnerId ? `?partner_id=${encodeURIComponent(partnerId)}` : ""}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        cache: "no-store",
    });
    if (!res.ok) return null;
    const me = (await res.json()) as Session;
    if (!me?.user) return null;
    return { user: me.user, account_type: me.account_type, partner_id: me.partner_id, partner: me.partner };
}

export function attachSession(res: NextResponse, token: string, session: Session): NextResponse {
    res.cookies.set(TOKEN_COOKIE, token, cookieOptions());
    res.cookies.set(SESSION_COOKIE, serializeSession(session), cookieOptions());
    return res;
}

export function clearSession(res: NextResponse): NextResponse {
    res.cookies.set(TOKEN_COOKIE, "", { ...cookieOptions(0) });
    res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions(0) });
    return res;
}

/** Only allow same-origin relative redirects. */
export function safeNext(next: string | null | undefined): string {
    if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
    return next;
}

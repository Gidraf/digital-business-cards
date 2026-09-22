/**
 * Session = the CVPAP JWT (issued by CVPAP /auth/login) kept in cookies so
 * both server components and client components can call the CVPAP API.
 *
 *   cvpap_token    — the bearer token (not httpOnly: the browser calls the
 *                    CVPAP API directly, same posture as the CVPAP dashboard
 *                    which keeps it in localStorage)
 *   cvpap_session  — JSON {user, account_type, partner_id, partner}
 */
export const TOKEN_COOKIE = "cvpap_token";
export const SESSION_COOKIE = "cvpap_session";
export const SESSION_MAX_AGE = 36 * 60 * 60; // CVPAP tokens last 36h

export interface SessionUser {
    id: string;
    name: string;
    email: string | null;
    username?: string;
}

export interface Session {
    user: SessionUser;
    account_type: "admin" | "partner";
    partner_id: string | null;
    partner: { id: string; name: string; email: string | null } | null;
}

export function parseSession(raw: string | undefined | null): Session | null {
    if (!raw) return null;
    try {
        const s = JSON.parse(raw) as Session;
        if (!s || !s.user || !s.account_type) return null;
        return s;
    } catch {
        return null;
    }
}

export function serializeSession(s: Session): string {
    return JSON.stringify(s);
}

/** Read a cookie in the browser. */
export function readCookie(name: string): string | null {
    if (typeof document === "undefined") return null;
    const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.$?*|{}()[\]\\/+^]/g, "\\$&")}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
}

export function getClientToken(): string | null {
    return readCookie(TOKEN_COOKIE);
}

export function getClientSession(): Session | null {
    return parseSession(readCookie(SESSION_COOKIE));
}

export function cookieOptions(maxAge = SESSION_MAX_AGE) {
    return {
        path: "/",
        maxAge,
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        httpOnly: false,
    };
}

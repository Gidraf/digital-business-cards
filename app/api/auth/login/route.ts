import { NextResponse, type NextRequest } from "next/server";
import { apiBase } from "@/lib/api";
import { attachSession, resolveSession } from "@/lib/session-server";

/**
 * Email/password sign-in against CVPAP (/auth/login), same accounts as the
 * CVPAP dashboard. On success the JWT + session are stored in cookies.
 */
export async function POST(request: NextRequest) {
    const { email, password } = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
    if (!email || !password) {
        return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    let upstream: Response;
    try {
        upstream = await fetch(`${apiBase()}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email, password }),
            cache: "no-store",
        });
    } catch {
        return NextResponse.json({ error: "Could not reach the CVPAP API" }, { status: 502 });
    }

    const body = (await upstream.json().catch(() => ({}))) as { error?: string; refresh_token?: string; account_type?: string };
    if (!upstream.ok || !body.refresh_token) {
        return NextResponse.json({ error: body.error ?? "Invalid credentials" }, { status: upstream.status === 401 ? 401 : 400 });
    }

    const session = await resolveSession(body.refresh_token);
    if (!session) {
        return NextResponse.json({ error: "Signed in, but the cards module is not available for this account" }, { status: 403 });
    }
    if (!session.partner_id) {
        return NextResponse.json({ error: "This account is not linked to a partner" }, { status: 403 });
    }
    return attachSession(NextResponse.json({ ok: true, session }), body.refresh_token, session);
}

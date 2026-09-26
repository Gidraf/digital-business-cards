import { NextResponse, type NextRequest } from "next/server";
import { attachSession, resolveSession, safeNext } from "@/lib/session-server";
import { withBase } from "@/lib/base-path";

/**
 * Single sign-on from the CVPAP dashboard: the sidebar link opens
 *   /auth/sso?token=<cvpap jwt>[&partner_id=…][&next=/print]
 * We validate the token with CVPAP, store the session and redirect.
 * Super-admins may pass partner_id to act on behalf of a partner.
 */
export async function GET(request: NextRequest) {
    const token = request.nextUrl.searchParams.get("token");
    const partnerId = request.nextUrl.searchParams.get("partner_id");
    const next = safeNext(request.nextUrl.searchParams.get("next"));
    const loginUrl = new URL(withBase("/login"), request.url);

    if (!token) {
        loginUrl.searchParams.set("error", "missing_token");
        return NextResponse.redirect(loginUrl);
    }
    const session = await resolveSession(token, partnerId);
    if (!session || !session.partner_id) {
        loginUrl.searchParams.set("error", "sso_failed");
        return NextResponse.redirect(loginUrl);
    }
    return attachSession(NextResponse.redirect(new URL(withBase(next), request.url)), token, session);
}

import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, TOKEN_COOKIE } from "@/lib/auth";

// Public routes — accessible without a CVPAP session
const PUBLIC_PREFIXES = ["/login", "/auth/sso", "/api/auth", "/api/proxy-image"];

export function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;
    const hasSession = !!request.cookies.get(TOKEN_COOKIE)?.value && !!request.cookies.get(SESSION_COOKIE)?.value;
    const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

    if (!hasSession && !isPublic) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.search = "";
        if (pathname !== "/") url.searchParams.set("next", pathname + request.nextUrl.search);
        return NextResponse.redirect(url);
    }

    if (hasSession && pathname === "/login") {
        const url = request.nextUrl.clone();
        url.pathname = "/";
        url.search = "";
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|csv)$).*)",
    ],
};

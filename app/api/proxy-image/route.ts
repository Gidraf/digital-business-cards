import { NextResponse, type NextRequest } from "next/server";

/**
 * Same-origin image fetch used when the browser cannot read a MinIO image
 * directly (CORS) while inlining images for print sheets.
 *
 * Only presigned object URLs (X-Amz-Signature) and hosts in
 * IMAGE_PROXY_ALLOWED_HOSTS / the CVPAP API host are proxied — never an
 * arbitrary URL.
 */
function allowedHosts(): Set<string> {
    const hosts = new Set<string>();
    for (const raw of [process.env.NEXT_PUBLIC_CVPAP_API_URL, process.env.CVPAP_API_URL]) {
        try { if (raw) hosts.add(new URL(raw).host); } catch { /* ignore */ }
    }
    for (const h of (process.env.IMAGE_PROXY_ALLOWED_HOSTS ?? "").split(",")) {
        if (h.trim()) hosts.add(h.trim());
    }
    return hosts;
}

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get("url");
    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return NextResponse.json({ error: "Invalid url" }, { status: 400 });
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return NextResponse.json({ error: "Unsupported protocol" }, { status: 400 });
    }
    const presigned = parsed.searchParams.has("X-Amz-Signature");
    if (!presigned && !allowedHosts().has(parsed.host)) {
        return NextResponse.json({ error: "Host not allowed" }, { status: 403 });
    }

    try {
        const res = await fetch(parsed.toString(), { cache: "no-store" });
        if (!res.ok) return NextResponse.json({ error: "Upstream error" }, { status: 502 });
        const type = res.headers.get("Content-Type") ?? "application/octet-stream";
        if (!type.startsWith("image/")) return NextResponse.json({ error: "Not an image" }, { status: 415 });
        const blob = await res.blob();
        return new NextResponse(blob, {
            headers: { "Content-Type": type, "Cache-Control": "private, max-age=300" },
        });
    } catch {
        return NextResponse.json({ error: "Failed to fetch image" }, { status: 500 });
    }
}

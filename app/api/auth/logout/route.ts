import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session-server";

export async function POST() {
    return clearSession(NextResponse.json({ ok: true }));
}

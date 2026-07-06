import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { readSessionCookie, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET() {
  const session = readSessionCookie((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? NextResponse.json({ user: session }) : NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

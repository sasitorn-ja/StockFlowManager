import { NextRequest, NextResponse } from "next/server";

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function hasValidSession(request: NextRequest) {
  const value = request.cookies.get("sbm_session")?.value;
  const secret = process.env.APP_SESSION_SECRET;
  if (!value || !secret) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), new TextEncoder().encode(payload));
    if (!valid) return false;
    const session = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as { sub?: string; exp?: number };
    return Boolean(session.sub && session.exp && session.exp > Math.floor(Date.now() / 1000));
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  if (await hasValidSession(request)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!api/auth|login|signed-out|_next/static|_next/image|favicon.ico|picture).*)"],
};

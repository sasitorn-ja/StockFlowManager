import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SSO, redirectUri, requireAuthSecrets } from "@/lib/auth/config";
import { verifyRmcIdToken } from "@/lib/auth/id-token";
import { createSessionCookie, FLOW_STATE_COOKIE, FLOW_VERIFIER_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const error = requestUrl.searchParams.get("error");
  const store = await cookies();
  const expectedState = store.get(FLOW_STATE_COOKIE)?.value;
  const verifier = store.get(FLOW_VERIFIER_COOKIE)?.value;
  if (error || !code || !state || !expectedState || !verifier || state !== expectedState) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error ?? "invalid_callback")}`, request.url));
  }

  try {
    const { clientSecret } = requireAuthSecrets();
    const tokenResponse = await fetch(SSO.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", client_id: SSO.clientId, client_secret: clientSecret, redirect_uri: redirectUri(request.url), code, code_verifier: verifier }),
      cache: "no-store",
    });
    if (!tokenResponse.ok) throw new Error(`Token exchange failed (${tokenResponse.status})`);
    const tokens = (await tokenResponse.json()) as { id_token?: string; access_token?: string };
    if (!tokens.id_token || !tokens.access_token) throw new Error("SSO response is missing tokens");
    const claims = verifyRmcIdToken(tokens.id_token, SSO.clientId, clientSecret, SSO.issuer);
    const userInfoResponse = await fetch(SSO.userInfoUrl, { headers: { authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
    if (!userInfoResponse.ok) throw new Error(`UserInfo failed (${userInfoResponse.status})`);
    const user = (await userInfoResponse.json()) as Record<string, unknown>;
    if (user.sub !== claims.sub) throw new Error("UserInfo subject does not match id_token");
    const firstName = String(user.FIRSTNAME_TH ?? user.FIRSTNAME_EN ?? "").trim();
    const lastName = String(user.LASTNAME_TH ?? user.LASTNAME_EN ?? "").trim();
    const session = createSessionCookie({
      sub: claims.sub!, email: typeof user.EMAIL === "string" ? user.EMAIL : undefined,
      name: `${firstName} ${lastName}`.trim() || String(user.USER ?? user.EMAIL ?? claims.sub),
      userId: typeof user.USER === "string" ? user.USER : undefined,
      department: typeof user.DEPARTMENT === "string" ? user.DEPARTMENT : undefined,
      division: typeof user.DIVISION === "string" ? user.DIVISION : undefined,
      image: typeof user.LINE_PROFILE_IMAGE_URL === "string" ? user.LINE_PROFILE_IMAGE_URL : undefined,
      exp: Math.floor(Date.now() / 1000) + 8 * 60 * 60,
    });
    const response = NextResponse.redirect(new URL("/overview", request.url));
    response.cookies.set(SESSION_COOKIE, session, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 8 * 60 * 60 });
    response.cookies.delete(FLOW_STATE_COOKIE); response.cookies.delete(FLOW_VERIFIER_COOKIE);
    return response;
  } catch (cause) {
    console.error("SSO callback failed", { message: cause instanceof Error ? cause.message : "Unknown error" });
    return NextResponse.redirect(new URL("/login?error=sso_failed", request.url));
  }
}

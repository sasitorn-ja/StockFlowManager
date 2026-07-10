import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createExpiredAuthCookieOptions } from "@/lib/auth/cookies";
import { postLogoutRedirectUri, SSO } from "@/lib/auth/config";
import { FLOW_STATE_COOKIE, FLOW_VERIFIER_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";

export async function GET(request: Request) {
  const url = new URL(SSO.endSessionUrl);
  url.search = new URLSearchParams({ client_id: SSO.clientId, post_logout_redirect_uri: postLogoutRedirectUri(request), state: randomBytes(24).toString("base64url") }).toString();
  const response = NextResponse.redirect(url);
  const expiredCookie = createExpiredAuthCookieOptions();
  response.cookies.set(SESSION_COOKIE, "", expiredCookie);
  response.cookies.set(FLOW_STATE_COOKIE, "", expiredCookie);
  response.cookies.set(FLOW_VERIFIER_COOKIE, "", expiredCookie);
  return response;
}

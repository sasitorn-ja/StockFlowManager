import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { postLogoutRedirectUri, SSO } from "@/lib/auth/config";
import { SESSION_COOKIE } from "@/lib/auth/session";

export async function GET(request: Request) {
  const url = new URL(SSO.endSessionUrl);
  url.search = new URLSearchParams({ client_id: SSO.clientId, post_logout_redirect_uri: postLogoutRedirectUri(request.url), state: randomBytes(24).toString("base64url") }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}

import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAuthCookieOptions } from "@/lib/auth/cookies";
import { SSO, redirectUri } from "@/lib/auth/config";
import { FLOW_STATE_COOKIE, FLOW_VERIFIER_COOKIE } from "@/lib/auth/session";

export async function GET(request: Request) {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(SSO.authorizeUrl);
  url.search = new URLSearchParams({
    client_id: SSO.clientId,
    redirect_uri: redirectUri(request),
    response_type: "code",
    scope: SSO.scope,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  const response = NextResponse.redirect(url);
  const options = createAuthCookieOptions(600);
  response.cookies.set(FLOW_STATE_COOKIE, state, options);
  response.cookies.set(FLOW_VERIFIER_COOKIE, verifier, options);
  return response;
}

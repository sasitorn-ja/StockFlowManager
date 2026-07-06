import { createHmac, timingSafeEqual } from "node:crypto";

type JwtHeader = { alg?: string };
export type IdTokenClaims = {
  sub?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  iss?: string;
  nonce?: string;
  [key: string]: unknown;
};

export function verifyRmcIdToken(token: string, clientId: string, clientSecret: string, issuer: string) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed id_token");
  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = JSON.parse(Buffer.from(encodedHeader, "base64url").toString()) as JwtHeader;
  if (header.alg !== "HS256") throw new Error("Unsupported id_token signing algorithm");

  const expected = createHmac("sha256", clientSecret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  const received = Buffer.from(encodedSignature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("Invalid id_token signature");
  }

  const claims = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as IdTokenClaims;
  const now = Math.floor(Date.now() / 1000);
  if (!claims.sub) throw new Error("id_token is missing sub");
  if (!claims.exp || claims.exp <= now) throw new Error("id_token is expired or missing exp");
  if (claims.iat && claims.iat > now + 300) throw new Error("id_token iat is in the future");
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(clientId)) throw new Error("Invalid id_token audience");

  const normalize = (value: string) => value.replace(/\/+$/, "");
  if (claims.iss && normalize(claims.iss) !== normalize(issuer)) {
    throw new Error("Invalid id_token issuer");
  }
  if (!claims.iss) {
    console.warn("SSO id_token is missing iss claim; accepting token after signature/audience/expiry validation", {
      expectedIssuer: issuer,
      sub: claims.sub,
    });
  }
  return claims;
}

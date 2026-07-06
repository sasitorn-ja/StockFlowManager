import { createHmac, timingSafeEqual } from "node:crypto";
import { requireAuthSecrets } from "./config";

export const SESSION_COOKIE = "sbm_session";
export const FLOW_STATE_COOKIE = "sbm_sso_state";
export const FLOW_VERIFIER_COOKIE = "sbm_sso_verifier";

export type AppSession = {
  sub: string;
  email?: string;
  name: string;
  userId?: string;
  department?: string;
  division?: string;
  image?: string;
  exp: number;
};

const encode = (value: string) => Buffer.from(value).toString("base64url");

export function createSessionCookie(session: AppSession) {
  const payload = encode(JSON.stringify(session));
  const { sessionSecret } = requireAuthSecrets();
  const signature = createHmac("sha256", sessionSecret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readSessionCookie(value?: string): AppSession | null {
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const { sessionSecret } = requireAuthSecrets();
  const expected = createHmac("sha256", sessionSecret).update(payload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    return null;
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as AppSession;
    return session.sub && session.exp > Math.floor(Date.now() / 1000) ? session : null;
  } catch {
    return null;
  }
}

export const SSO = {
  issuer: process.env.SSO_ISSUER ?? "https://rmc-sso.cipcloud.net",
  clientId: process.env.SSO_CLIENT_ID ?? "cpac_sb-m",
  authorizeUrl:
    process.env.SSO_AUTHORIZE_URL ??
    "https://rmc-sso.cipcloud.net/api/auth/oauth2/authorize",
  tokenUrl:
    process.env.SSO_TOKEN_URL ??
    "https://rmc-sso.cipcloud.net/api/auth/oauth2/token",
  userInfoUrl:
    process.env.SSO_USERINFO_URL ??
    "https://rmc-sso.cipcloud.net/api/auth/oauth2/userinfo",
  endSessionUrl:
    process.env.SSO_END_SESSION_URL ??
    "https://rmc-sso.cipcloud.net/api/auth/oauth2/endsession",
  scope: process.env.SSO_SCOPE ?? "openid profile email offline_access",
};

export function requireAuthSecrets() {
  const clientSecret = process.env.SSO_CLIENT_SECRET;
  const sessionSecret = process.env.APP_SESSION_SECRET;
  if (!clientSecret || !sessionSecret) {
    throw new Error("SSO_CLIENT_SECRET and APP_SESSION_SECRET must be configured");
  }
  return { clientSecret, sessionSecret };
}

export function redirectUri(requestUrl: string) {
  return (
    process.env.SSO_REDIRECT_URI ??
    `${new URL(requestUrl).origin}/api/auth/callback/rmc-sso`
  );
}

export function postLogoutRedirectUri(requestUrl: string) {
  return (
    process.env.SSO_POST_LOGOUT_REDIRECT_URI ??
    `${new URL(requestUrl).origin}/signed-out`
  );
}

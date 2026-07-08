const isProduction = process.env.NODE_ENV === "production";

export function createAuthCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function createExpiredAuthCookieOptions() {
  return {
    ...createAuthCookieOptions(0),
    expires: new Date(0),
  };
}

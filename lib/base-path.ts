function normalizeBasePath(value?: string | null) {
  if (!value) return "";

  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return "";

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, "");
}

export const appBasePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH);
const externalAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

export function withBasePath(path: string) {
  if (!path) return appBasePath || "/";
  if (/^https?:\/\//i.test(path)) return path;

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!appBasePath) return normalizedPath;

  return normalizedPath === "/" ? appBasePath : `${appBasePath}${normalizedPath}`;
}

export function getRequestOrigin(request: Request | URL | string) {
  const requestUrl = typeof request === "string" ? new URL(request) : request instanceof URL ? request : new URL(request.url);

  if (typeof request === "object" && "headers" in request) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    if (forwardedProto && forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`;
    }

    const host = request.headers.get("host")?.trim();
    if (host) {
      return `${requestUrl.protocol}//${host}`;
    }
  }

  return requestUrl.origin;
}

export function toAbsoluteAppUrl(request: Request | URL | string, path: string) {
  if (externalAppUrl) {
    const baseUrl = new URL(
      externalAppUrl.endsWith("/") ? externalAppUrl : `${externalAppUrl}/`
    );
    const relativePath = path.replace(/^\/+/, "");
    return relativePath ? new URL(relativePath, baseUrl) : baseUrl;
  }

  return new URL(withBasePath(path), getRequestOrigin(request));
}

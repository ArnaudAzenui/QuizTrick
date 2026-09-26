import { ROUTES } from "./constants";

/** Only local paths may be used as post-login destinations. */
export function loginDestination(next?: string | null): string {
  if (!next?.startsWith("/") || next.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(next)) return ROUTES.dashboard;
  const url = new URL(next, "https://quiztrick.local");
  return url.origin === "https://quiztrick.local" ? `${url.pathname}${url.search}${url.hash}` : ROUTES.dashboard;
}

export function loginLinkError(error?: string): string | undefined {
  if (error === "link_expired") return "This link has expired. Please request a new link.";
  if (error === "link_invalid") return "This link is invalid or has already been used. Please request a new link.";
}

export const ORIGIN_CONFIRMATION_KEY = "cesam:origin-confirmation";
export const SCROLL_RESTORE_KEY = "cesam:restore-scroll";
const APP_ORIGIN = "https://cesam.local";

export function safeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  try {
    const url = new URL(value, APP_ORIGIN);
    if (url.origin !== APP_ORIGIN) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function withReturnTo(href: string, returnTo: string) {
  const url = new URL(href, APP_ORIGIN);
  if (url.origin !== APP_ORIGIN) return href;
  const safeOrigin = safeReturnTo(returnTo);
  if (safeOrigin) url.searchParams.set("returnTo", safeOrigin);
  return `${url.pathname}${url.search}${url.hash}`;
}

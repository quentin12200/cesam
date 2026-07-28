export const ORIGIN_CONFIRMATION_KEY = "cesam:origin-confirmation";
export const ORIGIN_CONFIRMATION_EVENT = "cesam:origin-confirmation";
export const SCROLL_RESTORE_KEY = "cesam:restore-scroll";
export const TRANSIENT_MODAL_HISTORY_KEY = "cesam:transient-modal-history";
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

export function showOriginConfirmation(message: string) {
  window.dispatchEvent(new CustomEvent<string>(ORIGIN_CONFIRMATION_EVENT, { detail: message }));
}

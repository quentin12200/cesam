export const REPRODUCTION_RETURN_CONFIRMATION_KEY = "cesam:reproduction-return-confirmation";

export function safeReturnTo(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

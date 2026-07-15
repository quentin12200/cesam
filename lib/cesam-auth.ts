export const AUTHORIZED_EMAILS = ["leyrat.quentin@gmail.com", "gaec.cesam@gmail.com"];

export function getAuthorizedEmail(cookieHeader: string | null): string | null {
  const match = cookieHeader?.match(/(?:^|;\s*)cesam_session=([^;]+)/);
  if (!match) return null;

  const email = decodeURIComponent(match[1]).toLowerCase();
  return AUTHORIZED_EMAILS.includes(email) ? email : null;
}

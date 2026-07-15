import { SignJWT, jwtVerify } from "jose";

export const AUTHORIZED_EMAILS = ["leyrat.quentin@gmail.com", "gaec.cesam@gmail.com"];

export const SESSION_COOKIE_NAME = "cesam_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const SESSION_ISSUER = "cesam";

// Le secret sert à signer/vérifier le cookie de session. Sans lui, aucune
// session n'est acceptée (on refuse plutôt que de faire confiance à un cookie
// non signé). Doit être défini dans l'environnement (Vercel : CESAM_SESSION_SECRET).
function getSessionSecret(): Uint8Array | null {
  const secret = process.env.CESAM_SESSION_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

/** Émet un cookie de session signé pour un email déjà autorisé. */
export async function signSession(email: string): Promise<string> {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error("CESAM_SESSION_SECRET manquant : impossible de créer la session");
  }
  return new SignJWT({ email: email.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(SESSION_ISSUER)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(secret);
}

/** Vérifie un jeton de session et renvoie l'email si (et seulement si) il est
 *  correctement signé et fait partie des emails autorisés. */
export async function verifySessionToken(token: string | null | undefined): Promise<string | null> {
  if (!token) return null;
  const secret = getSessionSecret();
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: SESSION_ISSUER });
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    return AUTHORIZED_EMAILS.includes(email) ? email : null;
  } catch {
    return null;
  }
}

function readSessionCookie(cookieHeader: string | null): string | null {
  const match = cookieHeader?.match(/(?:^|;\s*)cesam_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/** Renvoie l'email autorisé porté par un en-tête Cookie, ou null. */
export async function getAuthorizedEmail(cookieHeader: string | null): Promise<string | null> {
  return verifySessionToken(readSessionCookie(cookieHeader));
}

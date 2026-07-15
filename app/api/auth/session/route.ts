import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { sendUnauthorizedAccessEmail } from "@/lib/gmail";
import {
  AUTHORIZED_EMAILS,
  getAuthorizedEmail,
  signSession,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/cesam-auth";

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "cesam-gaec-d781e";

// ClÃ©s publiques Google pour les tokens Firebase
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

async function verifyFirebaseToken(idToken: string) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
    audience: FIREBASE_PROJECT_ID,
  });
  return payload;
}

export async function GET(request: Request) {
  const email = await getAuthorizedEmail(request.headers.get("cookie"));
  if (email) return NextResponse.json({ ok: true, email });
  return NextResponse.json({ error: "no session" }, { status: 401 });
}

export async function POST(request: Request) {
  const { idToken } = await request.json();
  if (!idToken) return NextResponse.json({ error: "token required" }, { status: 400 });

  try {
    const payload = await verifyFirebaseToken(idToken);
    const email = (payload.email as string | undefined) ?? "";
    const name = (payload.name as string | undefined) ?? null;

    if (!AUTHORIZED_EMAILS.includes(email.toLowerCase())) {
      sendUnauthorizedAccessEmail(email, name).catch(() => null);
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const token = await signSession(email);
    const response = NextResponse.json({ ok: true, email });
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_MAX_AGE_SECONDS,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

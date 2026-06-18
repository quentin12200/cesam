import { NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { sendUnauthorizedAccessEmail } from "@/lib/gmail";

const AUTHORIZED_EMAILS = ["leyrat.quentin@gmail.com", "gaec.cesam@gmail.com"];

const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "cesam-gaec-d781e";

// Clés publiques Google pour les tokens Firebase
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
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/cesam_session=([^;]+)/);
  if (match) return NextResponse.json({ ok: true, email: decodeURIComponent(match[1]) });
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

    const response = NextResponse.json({ ok: true, email });
    response.cookies.set("cesam_session", email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("cesam_session");
  return response;
}

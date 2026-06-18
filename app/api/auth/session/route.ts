import { NextResponse } from "next/server";
import { getAdminApp } from "@/lib/firebase-admin";
import { getAuth } from "firebase-admin/auth";
import { sendUnauthorizedAccessEmail } from "@/lib/gmail";

const AUTHORIZED_EMAILS = ["leyrat.quentin@gmail.com", "gaec.cesam@gmail.com"];

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
    const decoded = await getAuth(getAdminApp()).verifyIdToken(idToken);
    const email = decoded.email ?? "";

    if (!AUTHORIZED_EMAILS.includes(email.toLowerCase())) {
      // Fire-and-forget notification
      sendUnauthorizedAccessEmail(email, decoded.name ?? null).catch(() => null);
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true, email });
    response.cookies.set("cesam_session", email, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 jours
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

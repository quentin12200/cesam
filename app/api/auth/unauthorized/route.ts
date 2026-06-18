import { NextResponse } from "next/server";
import { sendUnauthorizedAccessEmail } from "@/lib/gmail";

export async function POST(request: Request) {
  const { email, displayName } = await request.json();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });

  try {
    await sendUnauthorizedAccessEmail(email, displayName ?? null);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to send unauthorized email:", err);
    return NextResponse.json({ error: "mail failed" }, { status: 500 });
  }
}

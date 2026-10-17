import { NextResponse } from "next/server";
import { analyserMhe2026, appliquerMhe2026 } from "@/lib/mhe-2026-import";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET() {
  try {
    return NextResponse.json(await analyserMhe2026());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Analyse MHE impossible." }, { status: 409 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Confirmation manquante." }, { status: 400 }); }
  if (!body || typeof body !== "object" || (body as { confirmation?: unknown }).confirmation !== "IMPORT_MHE_2026") {
    return NextResponse.json({ error: "Confirmation IMPORT_MHE_2026 requise." }, { status: 400 });
  }
  try {
    return NextResponse.json(await appliquerMhe2026());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Synchronisation MHE impossible." }, { status: 409 });
  }
}

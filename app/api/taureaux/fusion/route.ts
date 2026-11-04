import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "Fusion temporairement désactivée pour vérifier la compilation." }, { status: 503 });
}

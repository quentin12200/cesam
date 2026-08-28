import { NextRequest, NextResponse } from "next/server";
import { createManualEchoRequest } from "@/lib/manual-echo-requests";

const MAX_BATCH_SIZE = 200;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { nutravs?: unknown };
  if (!Array.isArray(body.nutravs)) {
    return NextResponse.json({ error: "La liste des vaches est requise" }, { status: 400 });
  }

  const nutravs = [...new Set(
    body.nutravs.filter((nutrav): nutrav is string => typeof nutrav === "string" && nutrav.trim().length > 0),
  )];
  if (nutravs.length === 0 || nutravs.length > MAX_BATCH_SIZE) {
    return NextResponse.json({ error: "Sélection vide ou trop importante" }, { status: 400 });
  }

  let added = 0;
  let alreadyActive = 0;
  let rejected = 0;
  for (const nutrav of nutravs) {
    const result = await createManualEchoRequest({ nutrav });
    if (result.status === "ADDED") added += 1;
    else if (result.status === "ALREADY_ACTIVE") alreadyActive += 1;
    else rejected += 1;
  }

  return NextResponse.json({ added, alreadyActive, rejected });
}

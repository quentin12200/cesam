import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateActiveWeighingSession,
  isWeighingSessionStatus,
  listWeighingSessions,
} from "@/lib/weighing-sessions";

export async function POST() {
  try {
    return NextResponse.json(await getOrCreateActiveWeighingSession());
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10) || 20));
  const requestedStatus = request.nextUrl.searchParams.get("status");
  if (requestedStatus && !isWeighingSessionStatus(requestedStatus)) {
    return NextResponse.json({ error: "Statut de séance invalide." }, { status: 400 });
  }
  const status = requestedStatus && isWeighingSessionStatus(requestedStatus)
    ? requestedStatus
    : undefined;

  try {
    return NextResponse.json(await listWeighingSessions({
      page,
      limit,
      status,
    }));
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

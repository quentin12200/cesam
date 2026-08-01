import { NextResponse } from "next/server";
import { getWeighingSession, WeighingSessionError } from "@/lib/weighing-sessions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    return NextResponse.json(await getWeighingSession(id));
  } catch (error) {
    if (error instanceof WeighingSessionError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

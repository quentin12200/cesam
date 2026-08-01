import { NextResponse } from "next/server";
import { attachExistingWeightsToSession, WeighingSessionError } from "@/lib/weighing-sessions";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json() as { peseeIds?: unknown };
    const peseeIds = Array.isArray(body.peseeIds)
      ? body.peseeIds.filter((value): value is string => typeof value === "string")
      : [];
    return NextResponse.json(await attachExistingWeightsToSession(id, peseeIds));
  } catch (error) {
    if (error instanceof WeighingSessionError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "NOT_FOUND" ? 404 : 409 },
      );
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

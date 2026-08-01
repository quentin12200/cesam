import { NextResponse } from "next/server";
import { transitionWeighingSession, WeighingSessionError } from "@/lib/weighing-sessions";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    return NextResponse.json(await transitionWeighingSession(id, "ABANDONED"));
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

import { NextRequest, NextResponse } from "next/server";
import { getLatestWeights } from "@/lib/latest-weight";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (ids.length === 0) return NextResponse.json({});

  const map = await getLatestWeights(ids);
  const result: Record<string, { poids: number; date: string }> = {};
  for (const [id, w] of map) {
    result[id] = { poids: w.poids, date: w.date.toISOString() };
  }
  return NextResponse.json(result);
}

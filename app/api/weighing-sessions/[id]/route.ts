import { NextResponse } from "next/server";
import { getWeighingSessionHistoryDetail } from "@/lib/weighing-session-history";
import { parsePriceGroups } from "@/lib/price-simulation";
import {
  updateWeighingSessionMetadata,
  WeighingSessionError,
  type WeighingSessionMetadata,
} from "@/lib/weighing-sessions";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const detail = await getWeighingSessionHistoryDetail(id);
    return NextResponse.json({
      id: detail.id,
      startedAt: detail.startedAt,
      endedAt: detail.endedAt,
      status: detail.status,
      selectionData: detail.selectionData,
      simulationData: detail.simulationData,
      fieldEntries: detail.entries,
    });
  } catch (error) {
    if (error instanceof WeighingSessionError && error.code === "NOT_FOUND") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json() as Partial<WeighingSessionMetadata>;
    const metadata: WeighingSessionMetadata = {
      selectedPeseeIds: Array.isArray(body.selectedPeseeIds)
        ? body.selectedPeseeIds.filter((value): value is string => typeof value === "string")
        : [],
      summaryOpen: body.summaryOpen === true,
      simulationOpen: body.simulationOpen === true,
      priceGroups: parsePriceGroups(JSON.stringify(body.priceGroups ?? [])),
    };
    return NextResponse.json(await updateWeighingSessionMetadata(id, metadata));
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

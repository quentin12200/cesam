import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  deleteVelage,
  editVelage,
  getVelageDetails,
  VelageEditError,
  type EditVelageInput,
} from "@/lib/velage-edit";

function errorResponse(error: unknown, operation: string) {
  if (error instanceof VelageEditError) {
    const status = error.code === "NOT_FOUND" ? 404 : error.code === "INVALID" ? 400 : 409;
    return NextResponse.json({ error: error.message, deletion: error.preview }, { status });
  }
  console.error(`${operation} /api/velages/[id] error:`, error);
  return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json(await getVelageDetails(id, prisma));
  } catch (error) {
    return errorResponse(error, "GET");
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ success: true, deletion: await deleteVelage(id, prisma) });
  } catch (error) {
    return errorResponse(error, "DELETE");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json() as EditVelageInput;
    const velage = await editVelage(id, body, prisma);
    return NextResponse.json({ success: true, velage });
  } catch (err) {
    return errorResponse(err, "PATCH");
  }
}

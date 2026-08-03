import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { editVelage, VelageEditError, type EditVelageInput } from "@/lib/velage-edit";

export async function DELETE(
  _request: NextRequest,
  _context: { params: Promise<{ id: string }> }
) {
  return NextResponse.json(
    { error: "La suppression sécurisée d’un vêlage avec veaux liés sera améliorée séparément." },
    { status: 409 }
  );
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
    if (err instanceof VelageEditError) {
      const status = err.code === "NOT_FOUND" ? 404 : err.code === "INVALID" ? 400 : 409;
      return NextResponse.json({ error: err.message }, { status });
    }
    console.error("PATCH /api/velages/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

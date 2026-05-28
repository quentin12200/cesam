import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { statut, notes } = body;

  const prev = await prisma.ordonnance.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });

  const prevFields: Record<string, unknown> = {};
  if (statut !== undefined) prevFields.statut = prev.statut;
  if (notes !== undefined) prevFields.notes = prev.notes;

  try {
    const ordonnance = await prisma.ordonnance.update({
      where: { id },
      data: {
        ...(statut !== undefined && { statut }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    });

    const desc = "Ordonnance mise à jour";
    let undoId = "";
    try {
      undoId = await logAction("PATCH_ORDONNANCE", desc, { op: "update", model: "ordonnance", where: { id }, data: prevFields });
    } catch {}

    return NextResponse.json({ ...ordonnance, _undoId: undoId, _undoDesc: desc });
  } catch {
    return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const ordonnance = await prisma.ordonnance.findUnique({ where: { id } });
  if (!ordonnance) return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });

  try {
    await prisma.ordonnance.delete({ where: { id } });

    const desc = `Ordonnance ${ordonnance.medicamentNom || ''} supprimée`;
    let undoId = "";
    try {
      undoId = await logAction("DELETE_ORDONNANCE", desc, {
        op: "create",
        model: "ordonnance",
        data: { ...ordonnance, updatedAt: new Date() },
      });
    } catch {}

    return NextResponse.json({ ok: true, _undoId: undoId, _undoDesc: desc });
  } catch {
    return NextResponse.json({ error: "Ordonnance non trouvée" }, { status: 404 });
  }
}

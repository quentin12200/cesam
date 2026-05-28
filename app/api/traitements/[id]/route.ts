import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { statut, notes, dureeJours, veterinaire } = body;

  const prev = await prisma.traitement.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  const prevFields: Record<string, unknown> = {};
  if (statut !== undefined) prevFields.statut = prev.statut;
  if (notes !== undefined) prevFields.notes = prev.notes;
  if (dureeJours !== undefined) prevFields.dureeJours = prev.dureeJours;
  if (veterinaire !== undefined) prevFields.veterinaire = prev.veterinaire;

  try {
    const updated = await prisma.traitement.update({
      where: { id },
      data: {
        ...(statut !== undefined && { statut }),
        ...(notes !== undefined && { notes }),
        ...(dureeJours !== undefined && { dureeJours }),
        ...(veterinaire !== undefined && { veterinaire }),
      },
    });

    const desc = `Traitement ${prev.medicamentNom} mis à jour`;
    let undoId = "";
    try {
      undoId = await logAction("PATCH_TRAITEMENT", desc, { op: "update", model: "traitement", where: { id }, data: prevFields });
    } catch {}

    return NextResponse.json({ ...updated, _undoId: undoId, _undoDesc: desc });
  } catch {
    return NextResponse.json({ error: "Traitement non trouvé" }, { status: 404 });
  }
}

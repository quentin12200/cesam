import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { statut, notes, dureeJours, veterinaire, ordonnanceNumero } = body;

  const prev = await prisma.traitement.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  const prevFields: Record<string, unknown> = {};
  if (statut !== undefined) prevFields.statut = prev.statut;
  if (notes !== undefined) prevFields.notes = prev.notes;
  if (dureeJours !== undefined) prevFields.dureeJours = prev.dureeJours;
  if (veterinaire !== undefined) prevFields.veterinaire = prev.veterinaire;
  if (ordonnanceNumero !== undefined) prevFields.ordonnanceNumero = prev.ordonnanceNumero;

  try {
    const updated = await prisma.traitement.update({
      where: { id },
      data: {
        ...(statut !== undefined && { statut }),
        ...(notes !== undefined && { notes }),
        ...(dureeJours !== undefined && { dureeJours }),
        ...(veterinaire !== undefined && { veterinaire }),
        ...(ordonnanceNumero !== undefined && { ordonnanceNumero }),
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const prev = await prisma.traitement.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Non trouvé" }, { status: 404 });

  await prisma.traitement.delete({ where: { id } });

  const desc = `Traitement ${prev.medicamentNom} supprimé`;
  let undoId = "";
  try {
    undoId = await logAction("DELETE_TRAITEMENT", desc, {
      op: "create", model: "traitement",
      data: {
        animalId: prev.animalId, evenementId: prev.evenementId, medicamentId: prev.medicamentId,
        medicamentNom: prev.medicamentNom, dateDebut: prev.dateDebut, dureeJours: prev.dureeJours,
        voie: prev.voie, frequence: prev.frequence, doseRecommandee: prev.doseRecommandee, dose: prev.dose,
        uniteDosage: prev.uniteDosage, poidsUtilise: prev.poidsUtilise, motif: prev.motif,
        veterinaire: prev.veterinaire, executant: prev.executant, moment: prev.moment,
        ordonnanceNumero: prev.ordonnanceNumero, ordonnanceId: prev.ordonnanceId, ordonnanceAAssocier: prev.ordonnanceAAssocier,
        delaiAttenteViandeJ: prev.delaiAttenteViandeJ, delaiAttenteLaitJ: prev.delaiAttenteLaitJ,
        statut: prev.statut, notes: prev.notes, updatedAt: new Date(),
      },
    });
  } catch {}

  return NextResponse.json({ ok: true, _undoId: undoId, _undoDesc: desc });
}

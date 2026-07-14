import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

const EDITABLE_FIELDS = [
  "statut",
  "notes",
  "dateDebut",
  "dureeJours",
  "voie",
  "frequence",
  "dose",
  "uniteDosage",
  "motif",
  "veterinaire",
  "ordonnanceNumero",
] as const;

const TEXT_FIELDS = new Set([
  "statut",
  "notes",
  "voie",
  "frequence",
  "uniteDosage",
  "motif",
  "veterinaire",
  "ordonnanceNumero",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const prev = await prisma.traitement.findUnique({ where: { id } });
  if (!prev) {
    return NextResponse.json({ error: "Traitement non trouvé" }, { status: 404 });
  }

  if (body.dureeJours !== undefined && Number(body.dureeJours) < 1) {
    return NextResponse.json(
      { error: "La durée doit être d’au moins un jour" },
      { status: 400 }
    );
  }
  if (body.dose !== undefined && body.dose !== null && Number(body.dose) < 0) {
    return NextResponse.json(
      { error: "La quantité ne peut pas être négative" },
      { status: 400 }
    );
  }

  const prevFields: Record<string, unknown> = {};
  const data: Record<string, unknown> = {};

  for (const field of EDITABLE_FIELDS) {
    const value = body[field];
    if (value === undefined) continue;

    prevFields[field] = (prev as unknown as Record<string, unknown>)[field];

    if (field === "dateDebut") {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return NextResponse.json({ error: "Date de début invalide" }, { status: 400 });
      }
      data.dateDebut = date;
    } else if (field === "dureeJours") {
      data.dureeJours = Number(value);
    } else if (field === "dose") {
      data.dose = value === "" || value === null ? null : Number(value);
    } else if (TEXT_FIELDS.has(field)) {
      data[field] =
        typeof value === "string" ? value.trim() || null : value;
    }
  }

  const updated = await prisma.traitement.update({
    where: { id },
    data,
  });

  const desc = `Traitement ${prev.medicamentNom} mis à jour`;
  let undoId = "";
  try {
    undoId = await logAction("PATCH_TRAITEMENT", desc, {
      op: "update",
      model: "traitement",
      where: { id },
      data: prevFields,
    });
  } catch {}

  return NextResponse.json({ ...updated, _undoId: undoId, _undoDesc: desc });
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

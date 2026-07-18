import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

interface Target {
  animalId: string;
  evenementId?: string | null;
  doseRecommandee?: number | null;
  dose?: number | null;
  poidsUtilise?: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      targets, medicamentId, medicamentNom, dateDebut, dureeJours, voie, frequence, doseUnique,
      uniteDosage, motif, veterinaire, ordonnanceNumero, ordonnanceId, ordonnanceAAssocier,
      delaiAttenteViandeJ, delaiAttenteLaitJ, notes,
    } = body;

    const targetsList: Target[] = Array.isArray(targets) ? targets : [];
    if (targetsList.length === 0 || !medicamentNom?.trim() || !dateDebut) {
      return NextResponse.json({ error: "targets, medicamentNom et dateDebut requis" }, { status: 400 });
    }

    const resolvedDate = new Date(dateDebut);

    const traitements = await prisma.$transaction(
      targetsList.map((t) =>
        prisma.traitement.create({
          data: {
            animalId: t.animalId,
            evenementId: t.evenementId ?? null,
            medicamentId: medicamentId || null,
            medicamentNom: medicamentNom.trim(),
            dateDebut: resolvedDate,
            dureeJours: doseUnique ? 1 : dureeJours ?? 1,
            doseUnique: doseUnique === true,
            voie: voie?.trim() || null,
            frequence: doseUnique ? null : frequence?.trim() || null,
            doseRecommandee: t.doseRecommandee ?? null,
            dose: t.dose ?? t.doseRecommandee ?? null,
            uniteDosage: uniteDosage?.trim() || null,
            poidsUtilise: t.poidsUtilise ?? null,
            motif: motif?.trim() || null,
            veterinaire: veterinaire?.trim() || null,
            ordonnanceNumero: ordonnanceNumero?.trim() || null,
            ordonnanceId: ordonnanceId ?? null,
            ordonnanceAAssocier: ordonnanceAAssocier ?? false,
            delaiAttenteViandeJ: delaiAttenteViandeJ ?? null,
            delaiAttenteLaitJ: delaiAttenteLaitJ ?? null,
            notes: notes?.trim() || null,
            statut: doseUnique ? "TERMINE" : "EN_COURS",
          },
        })
      )
    );

    const desc = `Traitement ${medicamentNom.trim()} enregistré pour ${traitements.length} animal(s)`;
    let undoId = "";
    try {
      undoId = await logAction(
        "BATCH_TRAITEMENT",
        desc,
        traitements.map((t) => ({ op: "delete" as const, model: "traitement", id: t.id }))
      );
    } catch {}

    return NextResponse.json({ count: traitements.length, traitements, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/traitements/batch error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

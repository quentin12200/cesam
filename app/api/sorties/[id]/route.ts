import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const sortie = await prisma.sortie.findUnique({
      where: { id },
      include: { animal: { select: { id: true, nutrav: true, nobovi: true, statut: true } } },
    });
    if (!sortie) {
      return NextResponse.json({ error: "Sortie introuvable" }, { status: 404 });
    }

    await prisma.sortie.delete({ where: { id } });

    // Remettre l'animal en ACTIF seulement s'il n'a plus d'autres sorties
    const autresSorties = await prisma.sortie.count({
      where: { animalId: sortie.animalId },
    });
    if (autresSorties === 0) {
      await prisma.animal.update({
        where: { id: sortie.animalId },
        data: { statut: "ACTIF", updatedAt: new Date() },
      });
    }

    const desc = `Sortie de ${sortie.animal.nobovi ?? sortie.animal.nutrav} annulée`;
    let undoId = "";
    try {
      undoId = await logAction("DELETE_SORTIE", desc, [
        {
          op: "create",
          model: "sortie",
          data: {
            id: sortie.id,
            animalId: sortie.animalId,
            date: sortie.date,
            type: sortie.type,
            acheteur: sortie.acheteur,
            prixKilo: sortie.prixKilo,
            poids: sortie.poids,
            prixPrevuHT: sortie.prixPrevuHT,
            prixDefinitifHT: sortie.prixDefinitifHT,
            dateDebutEngr: sortie.dateDebutEngr,
            causeMortalite: sortie.causeMortalite,
            notes: sortie.notes,
            updatedAt: new Date(),
          },
        },
        { op: "update", model: "animal", where: { id: sortie.animalId }, data: { statut: "SORTI" } },
      ]);
    } catch {}

    return NextResponse.json({ ok: true, _undoId: undoId, _undoDesc: desc });
  } catch (err) {
    console.error("DELETE /api/sorties/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

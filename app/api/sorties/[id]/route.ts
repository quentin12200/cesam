import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { getAttenteInfoForTraitement } from "@/lib/withdrawal";
import { undoExitInTransaction, buildExitPatch } from "@/lib/grouped-sale";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { date, type, acheteur, poids, poidsVif, rendementCarcasse, prixKilo, prixDefinitifHT, notes, causeMortalite, confirmeAttente,
      categorieSortie, sexeSortie, modeVente, poidsVifVente, prixKgVif, poidsCarcasse, prixKgCarcasse } = body;

    const sortie = await prisma.sortie.findUnique({ where: { id } });
    if (!sortie) return NextResponse.json({ error: "Sortie introuvable" }, { status: 404 });

    const typeFinal = type ?? sortie.type;
    if (typeFinal === "BOUCHERIE" && !confirmeAttente) {
      const traitementsRecents = await prisma.traitement.findMany({
        where: { animalId: sortie.animalId, dateDebut: { gte: subDays(new Date(), 90) } },
        include: { medicament: { select: { delaiAttenteViandeJ: true, delaiAttenteLaitJ: true } } },
      });
      const enAttente = traitementsRecents.some((t) => getAttenteInfoForTraitement(t).enAttenteViande);
      if (enAttente) {
        return NextResponse.json(
          { error: "Cet animal est encore en délai d'attente viande. Confirme la sortie depuis le formulaire pour valider quand même." },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.sortie.update({
      where: { id },
      data: buildExitPatch(body, sortie),
    });

    await logAction("UPDATE_SORTIE", `Sortie ${id} modifiée`, []);
    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof Error && ["CHAMP_NUMERIQUE_INVALIDE", "DATE_SORTIE_INVALIDE"].includes(err.message)) {
      return NextResponse.json({ error: "Poids, prix ou date invalide" }, { status: 400 });
    }
    if (err instanceof Error && err.message.includes("P2025")) return NextResponse.json({ error: "Sortie déjà annulée" }, { status: 409 });
    console.error("PATCH /api/sorties/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

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

    // Suppression et réactivation atomiques : une erreur ne laisse jamais
    // l'animal actif avec une sortie encore enregistrée.
    const reactivated = await prisma.$transaction((tx) => undoExitInTransaction(id, sortie.animalId, tx));

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
            categorieSortie: sortie.categorieSortie,
            sexeSortie: sortie.sexeSortie,
            modeVente: sortie.modeVente,
            poidsVif: sortie.poidsVif,
            rendementCarcasse: sortie.rendementCarcasse,
            poidsVifVente: sortie.poidsVifVente,
            prixKgVif: sortie.prixKgVif,
            poidsCarcasse: sortie.poidsCarcasse,
            prixKgCarcasse: sortie.prixKgCarcasse,
            poids: sortie.poids,
            prixPrevuHT: sortie.prixPrevuHT,
            prixDefinitifHT: sortie.prixDefinitifHT,
            dateDebutEngr: sortie.dateDebutEngr,
            causeMortalite: sortie.causeMortalite,
            notes: sortie.notes,
            updatedAt: new Date(),
          },
        },
        ...(reactivated ? [{ op: "update" as const, model: "animal", where: { id: sortie.animalId }, data: { statut: "SORTI" } }] : []),
      ]);
    } catch {}

    return NextResponse.json({ ok: true, _undoId: undoId, _undoDesc: desc });
  } catch (err) {
    if (err instanceof Error && err.message.includes("P2025")) return NextResponse.json({ error: "Sortie déjà annulée" }, { status: 409 });
    console.error("DELETE /api/sorties/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

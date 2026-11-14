import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { getAttenteInfoForTraitement } from "@/lib/withdrawal";
import { undoExitInTransaction } from "@/lib/grouped-sale";

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

    const poidsFinal = poids !== undefined ? (poids !== null ? parseFloat(poids) : null) : sortie.poids;
    const prixKiloFinal = prixKilo !== undefined ? (prixKilo !== null ? parseFloat(prixKilo) : null) : sortie.prixKilo;
    const prixPrevuHT = poidsFinal && prixKiloFinal
      ? Math.round(poidsFinal * prixKiloFinal * 100) / 100
      : null;

    const updated = await prisma.sortie.update({
      where: { id },
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(type !== undefined && { type }),
        ...(categorieSortie !== undefined && { categorieSortie: categorieSortie || null }),
        ...(sexeSortie !== undefined && { sexeSortie: sexeSortie || null }),
        ...(modeVente !== undefined && { modeVente: modeVente || null }),
        ...(acheteur !== undefined && { acheteur: acheteur || null }),
        ...(poids !== undefined && { poids: poids !== null ? parseFloat(poids) : null }),
        ...(poidsVif !== undefined && { poidsVif: poidsVif !== null ? parseFloat(poidsVif) : null }),
        ...(rendementCarcasse !== undefined && { rendementCarcasse: rendementCarcasse !== null ? parseFloat(rendementCarcasse) : null }),
        ...(poidsVifVente !== undefined && { poidsVifVente: poidsVifVente !== null ? parseFloat(poidsVifVente) : null }),
        ...(prixKgVif !== undefined && { prixKgVif: prixKgVif !== null ? parseFloat(prixKgVif) : null }),
        ...(poidsCarcasse !== undefined && { poidsCarcasse: poidsCarcasse !== null ? parseFloat(poidsCarcasse) : null }),
        ...(prixKgCarcasse !== undefined && { prixKgCarcasse: prixKgCarcasse !== null ? parseFloat(prixKgCarcasse) : null }),
        ...(prixKilo !== undefined && { prixKilo: prixKilo !== null ? parseFloat(prixKilo) : null }),
        ...((poids !== undefined || prixKilo !== undefined) && { prixPrevuHT }),
        ...(prixDefinitifHT !== undefined && { prixDefinitifHT: prixDefinitifHT !== null ? parseFloat(prixDefinitifHT) : null }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(causeMortalite !== undefined && { causeMortalite: causeMortalite || null }),
        updatedAt: new Date(),
      },
    });

    await logAction("UPDATE_SORTIE", `Sortie ${id} modifiée`, []);
    return NextResponse.json(updated);
  } catch (err) {
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
    console.error("DELETE /api/sorties/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

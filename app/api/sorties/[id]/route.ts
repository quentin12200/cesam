import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { getAttenteInfoForTraitement } from "@/lib/withdrawal";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { date, type, acheteur, poids, poidsVif, rendementCarcasse, prixKilo, prixDefinitifHT, notes, causeMortalite, confirmeAttente } = body;

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
      data: {
        ...(date !== undefined && { date: new Date(date) }),
        ...(type !== undefined && { type }),
        ...(acheteur !== undefined && { acheteur: acheteur || null }),
        ...(poids !== undefined && { poids: poids !== null ? parseFloat(poids) : null }),
        ...(poidsVif !== undefined && { poidsVif: poidsVif !== null ? parseFloat(poidsVif) : null }),
        ...(rendementCarcasse !== undefined && { rendementCarcasse: rendementCarcasse !== null ? parseFloat(rendementCarcasse) : null }),
        ...(prixKilo !== undefined && { prixKilo: prixKilo !== null ? parseFloat(prixKilo) : null }),
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

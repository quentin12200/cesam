import { NextRequest, NextResponse } from "next/server";
import { subDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import { getAttenteInfoForTraitement } from "@/lib/withdrawal";
import { uniqueAnimalIds } from "@/lib/grouped-sale";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const annee = searchParams.get("annee");
    const type = searchParams.get("type");

    const where: Record<string, unknown> = {};
    if (type) where.type = type;
    if (annee) {
      const year = parseInt(annee);
      where.date = {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`),
      };
    }

    const sorties = await prisma.sortie.findMany({
      where,
      include: {
        animal: {
          select: { nutrav: true, nobovi: true, sexbov: true, danais: true },
        },
      },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(sorties);
  } catch (err) {
    console.error("GET /api/sorties error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      animalId,
      date,
      type,
      acheteur,
      prixKilo,
      poids,
      poidsVif,
      rendementCarcasse,
      prixDefinitifHT,
      dateDebutEngr,
      notes,
      causeMortalite,
      confirmeAttente,
      categorieSortie,
      sexeSortie,
      modeVente,
      poidsVifVente,
      prixKgVif,
      poidsCarcasse,
      prixKgCarcasse,
      animalIds,
      animalWeights,
    } = body;

    const groupedAnimalIds = uniqueAnimalIds(animalIds);

    if (groupedAnimalIds.length > 0) {
      if (!date || !type || !["ELEVAGE", "BOUCHERIE"].includes(type)) {
        return NextResponse.json({ error: "Date et type de vente requis" }, { status: 400 });
      }

      const animals = await prisma.animal.findMany({
        where: { id: { in: groupedAnimalIds }, statut: "ACTIF" },
        select: { id: true, nutrav: true, nobovi: true, sexbov: true, categorie: true },
      });
      if (animals.length !== groupedAnimalIds.length) {
        return NextResponse.json({ error: "Un animal sélectionné est introuvable ou déjà sorti" }, { status: 409 });
      }

      if (type === "BOUCHERIE" && !confirmeAttente) {
        const traitementsRecents = await prisma.traitement.findMany({
          where: { animalId: { in: groupedAnimalIds }, dateDebut: { gte: subDays(new Date(), 90) } },
          include: { medicament: { select: { delaiAttenteViandeJ: true, delaiAttenteLaitJ: true } } },
        });
        if (traitementsRecents.some((traitement) => getAttenteInfoForTraitement(traitement).enAttenteViande)) {
          return NextResponse.json(
            { error: "Au moins un animal est encore en délai d'attente viande." },
            { status: 409 },
          );
        }
      }

      const weightByAnimal = animalWeights && typeof animalWeights === "object"
        ? animalWeights as Record<string, unknown>
        : {};
      const prixKiloCommun = prixKilo != null ? Number(prixKilo) : null;
      const sorties = await prisma.$transaction(async (tx) => Promise.all(animals.map(async (animal) => {
        const poidsAnimalValue = weightByAnimal[animal.id];
        const poidsAnimal = poidsAnimalValue !== null && poidsAnimalValue !== undefined && poidsAnimalValue !== ""
          ? Number(poidsAnimalValue)
          : null;
        if (poidsAnimal !== null && !Number.isFinite(poidsAnimal)) throw new Error("Poids invalide");
        const prixPrevuAnimal = prixKiloCommun !== null && poidsAnimal !== null
          ? Math.round(prixKiloCommun * poidsAnimal * 100) / 100
          : null;
        const categorie = (animal.categorie ?? "").toUpperCase();
        const categorieAnimal = categorie.includes("GENISSE")
          ? "GENISSE"
          : categorie.includes("VELLE") || categorie.includes("VEAU")
            ? "VEAU"
            : categorie.includes("TAUREAU")
              ? "TAUREAU"
              : categorie.includes("VACHE")
                ? "VACHE"
                : animal.sexbov === "F" ? "VACHE" : "VEAU";
        const sortie = await tx.sortie.create({
          data: {
            animalId: animal.id,
            date: new Date(date),
            type,
            categorieSortie: categorieAnimal,
            sexeSortie: animal.sexbov === "M" ? "M" : "F",
            modeVente: modeVente ?? null,
            acheteur: acheteur ?? null,
            prixKilo: prixKiloCommun,
            poids: poidsAnimal,
            poidsVifVente: modeVente === "VIF" ? poidsAnimal : null,
            prixKgVif: modeVente === "VIF" ? prixKiloCommun : null,
            poidsCarcasse: modeVente === "CARCASSE" ? poidsAnimal : null,
            prixKgCarcasse: modeVente === "CARCASSE" ? prixKiloCommun : null,
            prixPrevuHT: prixPrevuAnimal,
            notes: notes ?? null,
            updatedAt: new Date(),
          },
        });
        await tx.animal.update({ where: { id: animal.id }, data: { statut: "SORTI", updatedAt: new Date() } });
        return sortie;
      })));

      const desc = `Vente groupée : ${sorties.length} animaux`;
      let undoId = "";
      try {
        undoId = await logAction("CREATE_SORTIE", desc, [
          ...sorties.map((sortie) => ({ op: "delete" as const, model: "sortie", id: sortie.id })),
          ...animals.map((animal) => ({ op: "update" as const, model: "animal", where: { id: animal.id }, data: { statut: "ACTIF" } })),
        ]);
      } catch {}

      return NextResponse.json({ sorties, _undoId: undoId, _undoDesc: desc }, { status: 201 });
    }

    if (!animalId || !date || !type) {
      return NextResponse.json(
        { error: "Champs manquants: animalId, date, type requis" },
        { status: 400 }
      );
    }

    const animal = await prisma.animal.findUnique({
      where: { id: animalId },
      select: { nutrav: true, nobovi: true },
    });

    if (type === "BOUCHERIE" && !confirmeAttente) {
      const traitementsRecents = await prisma.traitement.findMany({
        where: { animalId, dateDebut: { gte: subDays(new Date(), 90) } },
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

    const prixPrevuHT =
      prixKilo && poids ? Math.round(prixKilo * poids * 100) / 100 : null;

    const sortie = await prisma.sortie.create({
      data: {
        animalId,
        date: new Date(date),
        type,
        categorieSortie: categorieSortie ?? null,
        sexeSortie: sexeSortie ?? null,
        modeVente: modeVente ?? null,
        acheteur: acheteur ?? null,
        prixKilo: prixKilo ? parseFloat(prixKilo) : null,
        poids: poids ? parseFloat(poids) : null,
        poidsVif: poidsVif ? parseFloat(poidsVif) : null,
        rendementCarcasse: rendementCarcasse ? parseFloat(rendementCarcasse) : null,
        poidsVifVente: poidsVifVente != null ? parseFloat(poidsVifVente) : null,
        prixKgVif: prixKgVif != null ? parseFloat(prixKgVif) : null,
        poidsCarcasse: poidsCarcasse != null ? parseFloat(poidsCarcasse) : null,
        prixKgCarcasse: prixKgCarcasse != null ? parseFloat(prixKgCarcasse) : null,
        prixPrevuHT,
        prixDefinitifHT: prixDefinitifHT ? parseFloat(prixDefinitifHT) : null,
        dateDebutEngr: dateDebutEngr ? new Date(dateDebutEngr) : null,
        notes: notes ?? null,
        causeMortalite: type === "MORT" ? (causeMortalite ?? null) : null,
        updatedAt: new Date(),
      },
    });

    await prisma.animal.update({
      where: { id: animalId },
      data: { statut: "SORTI", updatedAt: new Date() },
    });

    const desc = `Sortie ${type.toLowerCase()} : ${animal?.nobovi ?? animal?.nutrav ?? animalId}`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_SORTIE", desc, [
        { op: "delete", model: "sortie", id: sortie.id },
        { op: "update", model: "animal", where: { id: animalId }, data: { statut: "ACTIF" } },
      ]);
    } catch {}

    return NextResponse.json({ ...sortie, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/sorties error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays } from "date-fns";
import { logAction, RevertStep } from "@/lib/action-log";
import { buildStandaloneNegativeEchoPlan } from "@/lib/standalone-negative-echo";

const DUREE_GESTATION = 285; // jours — Blonde Aquitaine

async function recordStandaloneNegativeEcho(animalId: string, date: string, remarque: unknown) {
  const echoDate = new Date(date);
  if (Number.isNaN(echoDate.getTime())) {
    return NextResponse.json({ error: "Date d’échographie invalide" }, { status: 400 });
  }

  const animal = await prisma.animal.findFirst({
    where: { id: animalId, sexbov: "F" },
    select: {
      id: true,
      aEchographier: true,
      reproductionEtatManuel: true,
      reproductionEtatPrecedent: true,
      reproductionEtatModifieAt: true,
      demandesEchographie: {
        where: { etat: "A_FAIRE" },
        select: {
          id: true,
          origine: true,
          etat: true,
          clotureeAt: true,
          requestKey: true,
          observation: true,
        },
      },
    },
  });
  if (!animal) {
    return NextResponse.json({ error: "Vache non trouvée" }, { status: 404 });
  }

  const observation = typeof remarque === "string" ? remarque : undefined;
  const plan = buildStandaloneNegativeEchoPlan(animal, echoDate, observation);
  let createdRequestId: string | null = null;

  await prisma.$transaction(async (tx) => {
    await tx.animal.update({ where: { id: animal.id }, data: plan.animalUpdate });
    for (const request of plan.requestUpdates) {
      await tx.demandeEchographie.update({ where: { id: request.id }, data: request.data });
    }
    if (plan.requestCreate) {
      const created = await tx.demandeEchographie.create({
        data: plan.requestCreate,
        select: { id: true },
      });
      createdRequestId = created.id;
    }
  });

  const desc = "Échographie négative enregistrée sans saillie ou IA connue";
  let undoId = "";
  try {
    const revertSteps: RevertStep[] = [
      {
        op: "update",
        model: "animal",
        where: { id: animal.id },
        data: {
          aEchographier: animal.aEchographier,
          reproductionEtatManuel: animal.reproductionEtatManuel,
          reproductionEtatPrecedent: animal.reproductionEtatPrecedent,
          reproductionEtatModifieAt: animal.reproductionEtatModifieAt,
        },
      },
      ...animal.demandesEchographie.map((request) => ({
        op: "update" as const,
        model: "demandeEchographie",
        where: { id: request.id },
        data: {
          etat: request.etat,
          clotureeAt: request.clotureeAt,
          requestKey: request.requestKey,
          observation: request.observation,
        },
      })),
    ];
    if (createdRequestId) revertSteps.push({ op: "delete", model: "demandeEchographie", id: createdRequestId });
    undoId = await logAction("CREATE_ECHOGRAPHIE", desc, revertSteps);
  } catch {}

  return NextResponse.json({
    animalId: animal.id,
    saillieId: null,
    dateEcho: echoDate.toISOString(),
    resultatEcho: "VIDE",
    observationEcho: observation?.trim() || null,
    _undoId: undoId,
    _undoDesc: desc,
  }, { status: 201 });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { animalId, saillieId, date, resultat, dateVelagePrevue: dateVelagePrevueStr, joursGestation, remarque, updateTaureau, taureauId } = body;

    if (!date || !resultat || !["PLEINE", "VIDE"].includes(resultat)) {
      return NextResponse.json({ error: "date et résultat sont requis" }, { status: 400 });
    }
    if (resultat === "VIDE" && !saillieId) {
      if (!animalId || typeof animalId !== "string") {
        return NextResponse.json({ error: "animalId est requis sans saillie ou IA" }, { status: 400 });
      }
      return recordStandaloneNegativeEcho(animalId, date, remarque);
    }
    if (!saillieId) {
      return NextResponse.json({ error: "Une saillie ou une IA est requise pour une échographie pleine" }, { status: 400 });
    }

    const saillie = await prisma.saillie.findUnique({
      where: { id: saillieId },
      include: { gestation: true },
    });

    if (!saillie) {
      return NextResponse.json({ error: "Saillie non trouvée" }, { status: 404 });
    }

    // Capture previous states for undo
    const prevGestation = saillie.gestation ? { ...saillie.gestation } : null;
    const prevAnimal = await prisma.animal.findUnique({ where: { id: saillie.animalId }, select: { aEchographier: true } });
    const prevAEchographier = prevAnimal?.aEchographier ?? false;
    const activeRequests = await prisma.demandeEchographie.findMany({
      where: { animalId: saillie.animalId, etat: "A_FAIRE", OR: [{ saillieId }, { saillieId: null }] },
      select: { id: true, etat: true, clotureeAt: true, requestKey: true },
    });

    const nouvelEtat = resultat === "PLEINE" ? "VERT" : "ROUGE";

    let dateVelagePrevue: Date | undefined;
    let joursGestationFinal: number | undefined;

    if (resultat === "PLEINE") {
      if (dateVelagePrevueStr) {
        // Date fournie directement par le formulaire (mode précis)
        dateVelagePrevue = new Date(dateVelagePrevueStr);
        joursGestationFinal = DUREE_GESTATION - differenceInDays(dateVelagePrevue, new Date(date));
      } else if (joursGestation) {
        // Compatibilité ascendante
        dateVelagePrevue = addDays(new Date(date), DUREE_GESTATION - joursGestation);
        joursGestationFinal = joursGestation;
      } else {
        // Fallback: calculer depuis la date de saillie
        dateVelagePrevue = addDays(new Date(saillie.date), DUREE_GESTATION);
        joursGestationFinal = differenceInDays(new Date(date), new Date(saillie.date));
      }
    }

    const gestationData = {
      etat: nouvelEtat,
      dateEcho: new Date(date),
      resultatEcho: resultat,
      observationEcho: typeof remarque === "string" ? remarque.trim() || null : null,
      joursGestation: joursGestationFinal ?? null,
      dateVelagePrevue: dateVelagePrevue ?? null,
      updatedAt: new Date(),
    };

    const [gestation] = await prisma.$transaction([
      saillie.gestation
        ? prisma.gestation.update({ where: { id: saillie.gestation.id }, data: gestationData })
        : prisma.gestation.create({ data: { saillieId, ...gestationData } }),
      // Clear the "à échographier" flag automatically
      prisma.animal.update({
        where: { id: saillie.animalId },
        data: { aEchographier: false },
      }),
      prisma.demandeEchographie.updateMany({
        where: { animalId: saillie.animalId, etat: "A_FAIRE", origine: "AUTOMATIQUE", OR: [{ saillieId }, { saillieId: null }] },
        data: { etat: "REALISEE", clotureeAt: new Date(date) },
      }),
      prisma.demandeEchographie.updateMany({
        where: { animalId: saillie.animalId, etat: "A_FAIRE", origine: "MANUELLE", OR: [{ saillieId }, { saillieId: null }] },
        data: { etat: "REALISEE", clotureeAt: new Date(date), requestKey: null },
      }),
    ]);
    const remainingEchoRequests = await prisma.demandeEchographie.count({
      where: { animalId: saillie.animalId, etat: "A_FAIRE" },
    });
    if (remainingEchoRequests > 0) {
      await prisma.animal.update({ where: { id: saillie.animalId }, data: { aEchographier: true } });
    }
    if (updateTaureau === true) {
      await prisma.saillie.update({
        where: { id: saillieId },
        data: { taureauId: typeof taureauId === "string" && taureauId ? taureauId : null },
      });
    }

    const desc = `Échographie ${resultat === "PLEINE" ? "positive" : "négative"} enregistrée`;
    let undoId = "";
    try {
      const revertSteps: RevertStep[] = [];
      if (prevGestation) {
        // Gestation existed before — revert to previous state
        revertSteps.push({
          op: "update",
          model: "gestation",
          where: { id: prevGestation.id },
          data: {
            etat: prevGestation.etat,
            dateEcho: prevGestation.dateEcho,
            resultatEcho: prevGestation.resultatEcho,
            observationEcho: prevGestation.observationEcho,
            joursGestation: prevGestation.joursGestation,
            dateVelagePrevue: prevGestation.dateVelagePrevue,
          },
        });
      } else {
        // Gestation was created new — delete it
        revertSteps.push({ op: "delete", model: "gestation", id: gestation.id });
      }
      // Restore animal's aEchographier flag
      revertSteps.push({ op: "update", model: "animal", where: { id: saillie.animalId }, data: { aEchographier: prevAEchographier } });
      for (const echoRequest of activeRequests) {
        revertSteps.push({
          op: "update",
          model: "demandeEchographie",
          where: { id: echoRequest.id },
          data: { etat: echoRequest.etat, clotureeAt: echoRequest.clotureeAt, requestKey: echoRequest.requestKey },
        });
      }
      if (updateTaureau === true) {
        revertSteps.push({
          op: "update",
          model: "saillie",
          where: { id: saillieId },
          data: { taureauId: saillie.taureauId },
        });
      }

      undoId = await logAction("CREATE_ECHOGRAPHIE", desc, revertSteps);
    } catch {}

    return NextResponse.json({ ...gestation, _undoId: undoId, _undoDesc: desc }, { status: saillie.gestation ? 200 : 201 });
  } catch (err) {
    console.error("POST /api/echographies error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

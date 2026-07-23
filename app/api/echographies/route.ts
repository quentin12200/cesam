import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays } from "date-fns";
import { logAction, RevertStep } from "@/lib/action-log";

const DUREE_GESTATION = 285; // jours — Blonde Aquitaine

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saillieId, date, resultat, dateVelagePrevue: dateVelagePrevueStr, joursGestation, remarque, updateTaureau, taureauId } = body;

    if (!saillieId || !date || !resultat) {
      return NextResponse.json({ error: "saillieId, date et resultat sont requis" }, { status: 400 });
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

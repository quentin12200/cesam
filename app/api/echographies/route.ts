import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays } from "date-fns";

const DUREE_GESTATION = 285; // jours — Blonde Aquitaine

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saillieId, date, resultat, dateVelagePrevue: dateVelagePrevueStr, joursGestation } = body;

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

    if (saillie.gestation) {
      const gestation = await prisma.gestation.update({
        where: { id: saillie.gestation.id },
        data: {
          etat: nouvelEtat,
          dateEcho: new Date(date),
          resultatEcho: resultat,
          joursGestation: joursGestationFinal ?? null,
          dateVelagePrevue: dateVelagePrevue ?? null,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json(gestation, { status: 200 });
    } else {
      const gestation = await prisma.gestation.create({
        data: {
          saillieId,
          etat: nouvelEtat,
          dateEcho: new Date(date),
          resultatEcho: resultat,
          joursGestation: joursGestationFinal ?? null,
          dateVelagePrevue: dateVelagePrevue ?? null,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json(gestation, { status: 201 });
    }
  } catch (err) {
    console.error("POST /api/echographies error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

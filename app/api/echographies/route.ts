import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { saillieId, date, resultat, joursGestation } = body;

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
    if (resultat === "PLEINE" && joursGestation) {
      // Calculer la date de vélage prévue à partir de la date de saillie et des jours de gestation
      const jourRestants = 280 - joursGestation;
      dateVelagePrevue = addDays(new Date(date), jourRestants);
    }

    if (saillie.gestation) {
      const gestation = await prisma.gestation.update({
        where: { id: saillie.gestation.id },
        data: {
          etat: nouvelEtat,
          dateEcho: new Date(date),
          resultatEcho: resultat,
          joursGestation: joursGestation ?? null,
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
          joursGestation: joursGestation ?? null,
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

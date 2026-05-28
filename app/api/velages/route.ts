import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { vacheNutrav, veauNutrav, date, qualificatif, capteur, pereNom } = body;

    if (!vacheNutrav || !date) {
      return NextResponse.json({ error: "vacheNutrav et date sont requis" }, { status: 400 });
    }

    const vache = await prisma.animal.findUnique({ where: { nutrav: vacheNutrav } });
    if (!vache) {
      return NextResponse.json({ error: `Vache avec NUTRAV ${vacheNutrav} non trouvée` }, { status: 404 });
    }

    let veauId: string | undefined;
    if (veauNutrav) {
      const veau = await prisma.animal.findUnique({ where: { nutrav: veauNutrav } });
      if (veau) {
        veauId = veau.id;
      }
    }

    // Chercher la gestation active la plus récente
    const derniereGestation = await prisma.gestation.findFirst({
      where: {
        saillie: { animalId: vache.id },
        etat: { in: ["VERT", "GRIS", "ROSE"] },
        velage: null,
      },
      orderBy: { createdAt: "desc" },
    });

    const velage = await prisma.velage.create({
      data: {
        vacheId: vache.id,
        veauId: veauId ?? null,
        date: new Date(date),
        qualificatif: qualificatif ?? "NORMAL",
        capteur: capteur ?? null,
        pereNom: pereNom ?? null,
        gestationId: derniereGestation?.id ?? null,
        updatedAt: new Date(),
      },
    });

    // Au vêlage, la vache redevient non tarie
    await prisma.animal.update({
      where: { nutrav: vacheNutrav },
      data: { tarieFaite: false },
    });

    // Si capteur utilisé, libérer ce capteur
    if (capteur) {
      await prisma.capteurVelage.updateMany({
        where: { numero: capteur },
        data: { actif: false, animalNutrav: null, animalNom: null, dateAttribution: null },
      });
    }

    return NextResponse.json(velage, { status: 201 });
  } catch (err) {
    console.error("POST /api/velages error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

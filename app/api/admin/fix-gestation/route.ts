import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Clôture la gestation ouverte d'une vache qui a déjà un vélage enregistré
export async function POST(request: NextRequest) {
  try {
    const { vacheNutrav } = await request.json();
    if (!vacheNutrav) return NextResponse.json({ error: "vacheNutrav requis" }, { status: 400 });

    const vache = await prisma.animal.findUnique({ where: { nutrav: vacheNutrav } });
    if (!vache) return NextResponse.json({ error: "Vache introuvable" }, { status: 404 });

    // Trouver le dernier vélage de cette vache
    const velage = await prisma.velage.findFirst({
      where: { vacheId: vache.id },
      orderBy: { date: "desc" },
    });
    if (!velage) return NextResponse.json({ error: "Aucun vélage trouvé pour cette vache" }, { status: 404 });

    // Trouver la gestation ouverte
    const gestation = await prisma.gestation.findFirst({
      where: {
        saillie: { animalId: vache.id },
        etat: { in: ["VERT", "GRIS", "ROSE"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!gestation) return NextResponse.json({ error: "Aucune gestation ouverte trouvée" }, { status: 404 });

    // Lier le vélage à la gestation et clôturer
    await prisma.$transaction([
      prisma.gestation.update({ where: { id: gestation.id }, data: { etat: "VELAGE" } }),
      prisma.velage.update({ where: { id: velage.id }, data: { gestationId: gestation.id } }),
    ]);

    return NextResponse.json({ success: true, velageId: velage.id, gestationId: gestation.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

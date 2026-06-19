import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function fixGestation(vacheNutrav: string) {
  const vache = await prisma.animal.findUnique({ where: { nutrav: vacheNutrav } });
  if (!vache) return { error: "Vache introuvable" };

  const velage = await prisma.velage.findFirst({
    where: { vacheId: vache.id },
    orderBy: { date: "desc" },
  });
  if (!velage) return { error: "Aucun vélage trouvé pour cette vache" };

  const gestation = await prisma.gestation.findFirst({
    where: { saillie: { animalId: vache.id }, etat: { in: ["VERT", "GRIS", "ROSE"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!gestation) return { error: "Aucune gestation ouverte trouvée" };

  await prisma.$transaction([
    prisma.gestation.update({ where: { id: gestation.id }, data: { etat: "VELAGE" } }),
    prisma.velage.update({ where: { id: velage.id }, data: { gestationId: gestation.id } }),
  ]);

  return { success: true, velageId: velage.id, gestationId: gestation.id };
}

// GET: /api/admin/fix-gestation?nutrav=0580
export async function GET(request: NextRequest) {
  const nutrav = request.nextUrl.searchParams.get("nutrav");
  if (!nutrav) return NextResponse.json({ error: "nutrav requis" }, { status: 400 });
  const result = await fixGestation(nutrav);
  return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
}

// POST: clôture la gestation ouverte d'une vache qui a déjà un vélage enregistré
export async function POST(request: NextRequest) {
  try {
    const { vacheNutrav } = await request.json();
    if (!vacheNutrav) return NextResponse.json({ error: "vacheNutrav requis" }, { status: 400 });
    const result = await fixGestation(vacheNutrav);
    return NextResponse.json(result, { status: "error" in result ? 400 : 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

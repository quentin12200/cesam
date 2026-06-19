import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const nutrav = request.nextUrl.searchParams.get("nutrav");
  if (!nutrav) return NextResponse.json({ error: "nutrav requis" }, { status: 400 });

  const vache = await prisma.animal.findUnique({
    where: { nutrav },
    include: {
      velagesVache: { orderBy: { date: "desc" }, take: 5, include: { veau: { select: { nutrav: true } } } },
      saillies: {
        orderBy: { date: "desc" }, take: 3,
        include: { gestation: { select: { id: true, etat: true } } },
      },
    },
  });

  if (!vache) return NextResponse.json({ error: "Vache introuvable" }, { status: 404 });

  // Veau 7496
  const veauNutrav = request.nextUrl.searchParams.get("veau");
  let veauInfo = null;
  if (veauNutrav) {
    const veau = await prisma.animal.findUnique({
      where: { nutrav: veauNutrav },
      include: { velageVeau: { include: { vache: { select: { nutrav: true } } } } },
    });
    veauInfo = veau ? { nutrav: veau.nutrav, velage: veau.velageVeau } : null;
  }

  return NextResponse.json({
    vache: { nutrav: vache.nutrav, nom: vache.nobovi },
    velages: vache.velagesVache,
    saillies: vache.saillies,
    veauInfo,
  });
}

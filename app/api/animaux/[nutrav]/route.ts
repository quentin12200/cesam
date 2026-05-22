import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ nutrav: string }> }
) {
  const { nutrav } = await params;

  const animal = await prisma.animal.findUnique({
    where: { nutrav },
    include: {
      mere: { select: { id: true, nutrav: true, nobovi: true } },
      taureau: true,
      veaux: {
        select: { id: true, nutrav: true, nobovi: true, danais: true, sexbov: true, statut: true },
        orderBy: { danais: "desc" },
      },
      vaccinations: { orderBy: { date: "desc" } },
      evenements: { orderBy: { date: "desc" } },
      pesees: { orderBy: { date: "desc" } },
      velagesVache: {
        orderBy: { date: "desc" },
        include: {
          veau: { select: { nutrav: true, nobovi: true, sexbov: true } },
        },
      },
      velageVeau: {
        include: {
          vache: { select: { nutrav: true, nobovi: true } },
        },
      },
      saillies: {
        orderBy: { date: "desc" },
        include: { gestation: true, taureau: true },
      },
    },
  });

  if (!animal) {
    return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
  }

  return NextResponse.json(animal);
}

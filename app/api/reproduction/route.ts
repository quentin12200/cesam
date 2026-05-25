export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const vaches = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      sexbov: "F",
      estGenisse: false,
    },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      danais: true,
      saillies: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          id: true,
          date: true,
          taureauId: true,
          taureau: { select: { nopere: true, nupere: true } },
          gestation: {
            select: {
              id: true,
              etat: true,
              dateVelagePrevue: true,
            },
          },
        },
      },
      velagesVache: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
      chaleurs: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
    orderBy: { nutrav: "asc" },
  });

  const result = vaches.map((v) => ({
    id: v.id,
    nutrav: v.nutrav,
    nobovi: v.nobovi,
    danais: v.danais.toISOString(),
    derniereSaillie: v.saillies[0]?.date?.toISOString() ?? null,
    gestationEtat: v.saillies[0]?.gestation?.etat ?? null,
    dateVelagePrevue: v.saillies[0]?.gestation?.dateVelagePrevue?.toISOString() ?? null,
    dernierVelage: v.velagesVache[0]?.date?.toISOString() ?? null,
    saillieId: v.saillies[0]?.id ?? null,
    taureauNom: v.saillies[0]?.taureau?.nopere ?? v.saillies[0]?.taureau?.nupere ?? null,
    derniereChaleur: v.chaleurs[0]?.date?.toISOString() ?? null,
  }));

  return NextResponse.json({ vaches: result });
}

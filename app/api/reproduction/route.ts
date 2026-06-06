export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

export async function GET() {
  const now = new Date();
  // Génisses ≥ 24 mois (grandes génisses) entrent en reproduction
  const dateMax24Mois = addDays(now, -(24 * 30.44));

  const vaches = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      sexbov: "F",
      NOT: { categorie: "ENGRAISSEMENT" },
      OR: [
        { estGenisse: false },
        { estGenisse: true, danais: { lte: dateMax24Mois } },
      ],
    },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      danais: true,
      estGenisse: true,
      aEchographier: true,
      categorie: true,
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
    derniereChaleur: (() => {
      const chaleur = v.chaleurs[0]?.date ?? null;
      if (!chaleur) return null;
      const saillieDate = v.saillies[0]?.date ?? null;
      if (saillieDate && saillieDate >= chaleur) return null;
      return chaleur.toISOString();
    })(),
    aEchographier: v.aEchographier,
    estGenisse: v.estGenisse,
    categorie: v.categorie ?? null,
  }));

  return NextResponse.json({ vaches: result });
}

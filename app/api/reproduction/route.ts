export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { subMonths } from "date-fns";
import { syncAutomaticEchoRequests } from "@/lib/echo-requests";

export async function GET() {
  await syncAutomaticEchoRequests();
  const now = new Date();
  const dateMin24Mois = subMonths(now, 24);

  const vaches = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      sexbov: "F",
      AND: [
        {
          OR: [
            { categorie: null },
            { categorie: { not: "ENGRAISSEMENT" } },
          ],
        },
        {
          // Entrent en repro : vaches ≥ 24 mois, ou jeune vache ayant déjà vêlé,
          // ou grande génisse ≥ 24 mois. Exclut toute femelle < 24 mois sans velage.
          OR: [
            { estGenisse: false, danais: { lte: dateMin24Mois } },
            { estGenisse: false, velagesVache: { some: {} } },
            { estGenisse: true, danais: { lte: dateMin24Mois } },
          ],
        },
      ],
    },
    select: {
      id: true,
      nutrav: true,
      nobovi: true,
      danais: true,
      estGenisse: true,
      aEchographier: true,
      demandesEchographie: {
        where: { etat: "A_FAIRE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { origine: true, motif: true },
      },
      reproductionEtatManuel: true,
      reproductionEtatPrecedent: true,
      reproductionEtatModifieAt: true,
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
    aEchographier: v.demandesEchographie.length > 0,
    echoRequestOrigine: v.demandesEchographie[0]?.origine ?? null,
    echoRequestMotif: v.demandesEchographie[0]?.motif ?? null,
    reproductionEtatManuel: v.reproductionEtatManuel,
    reproductionEtatPrecedent: v.reproductionEtatPrecedent,
    reproductionEtatModifieAt: v.reproductionEtatModifieAt?.toISOString() ?? null,
    estGenisse: v.estGenisse,
    categorie: v.categorie ?? null,
  }));

  return NextResponse.json({ vaches: result });
}

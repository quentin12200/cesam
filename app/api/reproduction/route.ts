export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addDays, differenceInDays, subMonths } from "date-fns";
import { syncAutomaticEchoRequests } from "@/lib/echo-requests";
import { getCurrentCycleBreeding } from "@/lib/current-reproduction-cycle";
import { getEchoListEntryDays, getEchoListStatus } from "@/lib/echo-list-status";
import { parseReproductionRules } from "@/lib/reproduction-rules";

export async function GET() {
  await syncAutomaticEchoRequests();
  const now = new Date();
  const dateMin24Mois = subMonths(now, 24);
  const storedRules = await prisma.exploitationConfig.findUnique({
    where: { id: "singleton" },
    select: { reproductionRulesJson: true },
  }).catch(() => null);
  const rules = parseReproductionRules(storedRules?.reproductionRulesJson);
  const echoListEnabled = rules.phases.find((phase) => phase.id === "echo_due")?.enabledAlert ?? true;
  const echoEntryDays = getEchoListEntryDays(rules.echoTiming);

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
        select: {
          id: true,
          date: true,
          type: true,
          taureauId: true,
          taureau: { select: { nopere: true, nupere: true } },
          gestation: {
            select: {
              id: true,
              etat: true,
              dateEcho: true,
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

  const result = vaches.map((v) => {
    const lastCalving = v.velagesVache[0]?.date ?? null;
    const currentBreeding = getCurrentCycleBreeding(v.saillies, lastCalving);
    const activeRequest = v.demandesEchographie[0] ?? null;
    const daysSinceBreeding = currentBreeding ? differenceInDays(now, currentBreeding.date) : null;
    const explicitControl = activeRequest?.origine === "MANUELLE";
    const belongsToEchoList = Boolean(
      echoListEnabled
      && activeRequest
      && currentBreeding
      && (explicitControl || !currentBreeding.gestation?.dateEcho)
      && (explicitControl || (daysSinceBreeding !== null && daysSinceBreeding >= echoEntryDays))
    );
    const echoStatus = belongsToEchoList && daysSinceBreeding !== null
      ? getEchoListStatus(daysSinceBreeding, rules.echoTiming.dueFromDays)
      : null;
    const echoDueDate = currentBreeding ? addDays(currentBreeding.date, rules.echoTiming.dueFromDays) : null;
    return {
    id: v.id,
    nutrav: v.nutrav,
    nobovi: v.nobovi,
    danais: v.danais.toISOString(),
    derniereSaillie: currentBreeding?.date.toISOString() ?? null,
    gestationEtat: currentBreeding?.gestation?.etat ?? null,
    dateVelagePrevue: currentBreeding?.gestation?.dateVelagePrevue?.toISOString() ?? null,
    dernierVelage: v.velagesVache[0]?.date?.toISOString() ?? null,
    saillieId: currentBreeding?.id ?? null,
    saillieType: currentBreeding?.type ?? null,
    taureauNom: currentBreeding?.taureau?.nopere ?? currentBreeding?.taureau?.nupere ?? null,
    derniereChaleur: (() => {
      const chaleur = v.chaleurs[0]?.date ?? null;
      if (!chaleur) return null;
      const saillieDate = currentBreeding?.date ?? null;
      if (saillieDate && saillieDate >= chaleur) return null;
      return chaleur.toISOString();
    })(),
    aEchographier: belongsToEchoList,
    echoRequestOrigine: activeRequest?.origine ?? null,
    echoRequestMotif: activeRequest?.motif ?? null,
    echoStatusLabel: echoStatus?.label ?? null,
    echoCountdown: echoStatus?.countdown ?? null,
    echoSortGroup: echoStatus?.sortGroup ?? null,
    echoDueDate: echoDueDate?.toISOString() ?? null,
    reproductionEtatManuel: v.reproductionEtatManuel,
    reproductionEtatPrecedent: v.reproductionEtatPrecedent,
    reproductionEtatModifieAt: v.reproductionEtatModifieAt?.toISOString() ?? null,
    estGenisse: v.estGenisse,
    categorie: v.categorie ?? null,
  }});

  return NextResponse.json({ vaches: result });
}

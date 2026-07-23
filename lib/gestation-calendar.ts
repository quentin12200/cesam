import { prisma } from "@/lib/prisma";
import { getEtatGestation, type EtatGestation } from "@/lib/utils";
import { subMonths } from "date-fns";

export interface GestationCalendarRow {
  id: string;
  nutrav: string;
  nobovi: string | null;
  estGenisse: boolean;
  categorie: string | null;
  etat: EtatGestation;
  dateVelagePrevue: Date;
  taureauNom: string | null;
  saillieDate: Date | null;
}

export async function getGestationCalendar(): Promise<GestationCalendarRow[]> {
  const now = new Date();
  const dateMin24Mois = subMonths(now, 24);

  const vaches = await prisma.animal.findMany({
    where: {
      statut: "ACTIF",
      sexbov: "F",
      AND: [
        { OR: [{ categorie: null }, { categorie: { not: "ENGRAISSEMENT" } }] },
        {
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
      estGenisse: true,
      categorie: true,
      aEchographier: true,
      saillies: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          date: true,
          taureau: { select: { nopere: true, nupere: true } },
          gestation: { select: { etat: true, dateVelagePrevue: true } },
        },
      },
      velagesVache: {
        orderBy: { date: "desc" },
        take: 1,
        select: { date: true },
      },
    },
  });

  return vaches
    .flatMap((v) => {
      const saillie = v.saillies[0];
      if (!saillie?.gestation?.dateVelagePrevue) return [];
      const etat = getEtatGestation(
        saillie.date ? new Date(saillie.date) : null,
        saillie.gestation.etat,
        new Date(saillie.gestation.dateVelagePrevue),
        v.velagesVache[0]?.date ? new Date(v.velagesVache[0].date) : null,
        false
      ) as EtatGestation;
      if (etat !== "VERT" && etat !== "ROSE") return [];
      return [{
        id: v.id,
        nutrav: v.nutrav,
        nobovi: v.nobovi,
        estGenisse: v.estGenisse,
        categorie: v.categorie,
        etat,
        dateVelagePrevue: saillie.gestation.dateVelagePrevue,
        taureauNom: saillie.taureau?.nopere ?? saillie.taureau?.nupere ?? null,
        saillieDate: saillie.date,
      }];
    })
    .sort((a, b) => a.dateVelagePrevue.getTime() - b.dateVelagePrevue.getTime());
}

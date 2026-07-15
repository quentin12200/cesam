export const dynamic = "force-dynamic";

import { subDays, differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import TroupeauTabs from "@/components/TroupeauTabs";
import IdentificationClient, { type VeauIdentification } from "./IdentificationClient";

export default async function IdentificationPage() {
  const now = new Date();
  const depuis = subDays(now, 30);

  const [aBoucler, recemmentBoucles] = await Promise.all([
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        boucleFaite: false,
        velageVeau: { isNot: null },
      },
      select: {
        id: true,
        nutrav: true,
        nobovi: true,
        danais: true,
        dateBouclage: true,
        velageVeau: {
          select: {
            vache: { select: { nutrav: true, nobovi: true } },
          },
        },
      },
      orderBy: { danais: "asc" },
    }),
    prisma.animal.findMany({
      where: {
        statut: "ACTIF",
        boucleFaite: true,
        dateBouclage: { gte: depuis },
        velageVeau: { isNot: null },
      },
      select: {
        id: true,
        nutrav: true,
        nobovi: true,
        danais: true,
        dateBouclage: true,
        velageVeau: {
          select: {
            vache: { select: { nutrav: true, nobovi: true } },
          },
        },
      },
      orderBy: { dateBouclage: "desc" },
    }),
  ]);

  function serialize(animal: (typeof aBoucler)[number]): VeauIdentification {
    return {
      id: animal.id,
      nutrav: animal.nutrav,
      nobovi: animal.nobovi,
      danais: animal.danais.toISOString(),
      ageJours: differenceInDays(now, animal.danais),
      mereNutrav: animal.velageVeau?.vache.nutrav ?? null,
      mereNom: animal.velageVeau?.vache.nobovi ?? null,
      dateBouclage: animal.dateBouclage?.toISOString() ?? null,
    };
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 pb-24">
      <TroupeauTabs />
      <div className="mt-2">
        <h1 className="text-xl font-bold text-gray-900">Identification</h1>
        <p className="text-xs text-gray-500">Boucler les veaux et corriger les erreurs récentes</p>
      </div>
      <IdentificationClient
        aBoucler={aBoucler.map(serialize)}
        recemmentBoucles={recemmentBoucles.map(serialize)}
      />
    </div>
  );
}

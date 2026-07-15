export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getEtatGestation, type EtatGestation } from "@/lib/utils";

const STATUTS: EtatGestation[] = ["VERT", "ROUGE", "JAUNE", "REPOS", "ROSE", "GRIS"];

function statutAutomatique(animal: {
  aEchographier: boolean;
  saillies: { date: Date; gestation: { etat: string; dateVelagePrevue: Date | null } | null }[];
  velagesVache: { date: Date }[];
}): EtatGestation {
  const saillie = animal.saillies[0];
  return getEtatGestation(
    saillie?.date ?? null,
    saillie?.gestation?.etat ?? null,
    saillie?.gestation?.dateVelagePrevue ?? null,
    animal.velagesVache[0]?.date ?? null,
    animal.aEchographier
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const animalIds: string[] = Array.isArray(body?.animalIds)
    ? Array.from(
        new Set<string>(
          body.animalIds.filter(
            (id: unknown): id is string => typeof id === "string" && id.length > 0
          )
        )
      )
    : [];
  const restaurer = body?.restaurer === true;
  const statut = body?.statut as EtatGestation | undefined;

  if (animalIds.length === 0 || (!restaurer && (!statut || !STATUTS.includes(statut)))) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const animaux = await prisma.animal.findMany({
    where: { id: { in: animalIds }, sexbov: "F" },
    select: {
      id: true,
      nutrav: true,
      aEchographier: true,
      reproductionEtatManuel: true,
      reproductionEtatPrecedent: true,
      reproductionEtatModifieAt: true,
      saillies: {
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: {
          date: true,
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

  if (animaux.length !== animalIds.length) {
    return NextResponse.json({ error: "Un ou plusieurs animaux sont introuvables" }, { status: 404 });
  }

  if (restaurer) {
    const sansPrecedent = animaux.find((animal) =>
      !animal.reproductionEtatPrecedent || !STATUTS.includes(animal.reproductionEtatPrecedent as EtatGestation)
    );
    if (sansPrecedent) {
      return NextResponse.json(
        { error: `Aucun statut précédent pour ${sansPrecedent.nutrav}` },
        { status: 400 }
      );
    }
  }

  const now = new Date();
  const changements = animaux.map((animal) => {
    const courant = (animal.reproductionEtatManuel as EtatGestation | null) ?? statutAutomatique(animal);
    const cible = restaurer ? animal.reproductionEtatPrecedent as EtatGestation : statut!;
    return { animal, courant, cible };
  });

  try {
    await prisma.$transaction(async (tx) => {
      for (const { animal, courant, cible } of changements) {
        await tx.animal.update({
          where: { id: animal.id },
          data: {
            reproductionEtatManuel: cible,
            reproductionEtatPrecedent: courant,
            reproductionEtatModifieAt: now,
          },
        });
      }

      await tx.actionLog.create({
        data: {
          type: restaurer ? "REPRO_STATUT_RESTAURE" : animalIds.length > 1 ? "REPRO_STATUT_GROUPE" : "REPRO_STATUT",
          description: restaurer
            ? `Retour au statut précédent pour ${animaux.length} animal(aux)`
            : `Statut reproductif modifié pour ${animaux.length} animal(aux)`,
          revertData: JSON.stringify(changements.map(({ animal }) => ({
            op: "update",
            model: "animal",
            where: { id: animal.id },
            data: {
              reproductionEtatManuel: animal.reproductionEtatManuel,
              reproductionEtatPrecedent: animal.reproductionEtatPrecedent,
              reproductionEtatModifieAt: animal.reproductionEtatModifieAt,
            },
          }))),
        },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Modification impossible";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    changements: changements.map(({ animal, courant, cible }) => ({
      animalId: animal.id,
      ancienStatut: courant,
      nouveauStatut: cible,
      modifieAt: now.toISOString(),
    })),
  });
}

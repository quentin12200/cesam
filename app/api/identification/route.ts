export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  genererNumerosLibresDuLot,
  type GenerationLotBoucles,
} from "@/lib/identification";
import {
  obtenirLotBouclesActif,
  obtenirNumerosIdentificationUtilises,
} from "@/lib/lot-boucles";

function apercuLot(
  premierNunati: string,
  quantite: number,
  generation: GenerationLotBoucles
) {
  return {
    quantiteDemandee: quantite,
    premierNumero: premierNunati,
    premierNumeroLibre: generation.premierNumero,
    dernierNumero: generation.dernierNumero,
    numeros: generation.numeros,
    sautes: generation.sautes,
  };
}

async function lire() {
  const [config, lotActif, lotsEnAttente, utilises] = await Promise.all([
    prisma.exploitationConfig.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    }),
    obtenirLotBouclesActif(),
    prisma.lotBoucles.findMany({
      where: { actif: false },
      orderBy: { createdAt: "asc" },
    }),
    obtenirNumerosIdentificationUtilises(),
  ]);
  const restantes = lotActif
    ? Math.max(0, lotActif.quantite - lotActif.prochainIndex)
    : 0;
  let proposition = null;
  if (lotActif && restantes > 0) {
    try {
      const prochaine = genererNumerosLibresDuLot(
        lotActif.premierNunati,
        1,
        utilises
      ).numeros[0];
      proposition = prochaine
        ? { nutrav: prochaine.nutrav, nunati: prochaine.nunati }
        : null;
    } catch {
      proposition = null;
    }
  }

  return {
    config,
    lotActif: lotActif ? { ...lotActif, restantes } : null,
    lotsEnAttente: lotsEnAttente.filter(
      (lot) => lot.prochainIndex < lot.quantite
    ),
    proposition,
  };
}

export async function GET() {
  return NextResponse.json(await lire());
}

export async function POST(request: Request) {
  const body = await request.json();
  const premierNunati = String(body.premierNunati ?? "").trim().toUpperCase();
  const quantite = Number(body.quantite);
  const premierNutrav = premierNunati.match(/(\d{4})$/)?.[1];
  if (!premierNutrav || !Number.isInteger(quantite) || quantite < 1) {
    return NextResponse.json(
      {
        error:
          "Numéro national complet avec 4 chiffres finaux et quantité requis",
      },
      { status: 400 }
    );
  }

  const utilises = await obtenirNumerosIdentificationUtilises();
  let generation: GenerationLotBoucles;
  try {
    generation = genererNumerosLibresDuLot(
      premierNunati,
      quantite,
      utilises
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "La série de numéros libres ne peut pas être calculée.",
      },
      { status: 422 }
    );
  }

  const apercu = apercuLot(premierNunati, quantite, generation);
  if (body.preview === true) {
    return NextResponse.json({ preview: apercu });
  }

  // Le contrôle est volontairement refait ici, dans la requête de validation :
  // un conflit apparu depuis l’aperçu est sauté et prolonge la série finale.
  const lotActif = await obtenirLotBouclesActif();
  await prisma.$transaction([
    prisma.lotBoucles.create({
      data: {
        reference: null,
        premierNutrav,
        premierNunati,
        quantite,
        prochainIndex: 0,
        actif: !lotActif,
      },
    }),
    prisma.exploitationConfig.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        identificationMode: "TRAVAIL_ET_NATIONAL",
        nutravNbChiffres: 4,
        nutravZerosGauche: true,
        propositionAutoNumero: true,
        serieCommuneSexes: true,
      },
      update: {
        identificationMode: "TRAVAIL_ET_NATIONAL",
        nutravNbChiffres: 4,
        nutravZerosGauche: true,
        propositionAutoNumero: true,
        serieCommuneSexes: true,
      },
    }),
  ]);

  return NextResponse.json(
    { ...(await lire()), creation: apercu },
    { status: 201 }
  );
}

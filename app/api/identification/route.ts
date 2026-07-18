export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { numeroNationalDuLot, propositionLot } from "@/lib/identification";

async function lire() {
  const config = await prisma.exploitationConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
  const lotActif = await prisma.lotBoucles.findFirst({ where: { actif: true }, orderBy: { createdAt: "desc" } });
  return { config, lotActif, proposition: lotActif && lotActif.prochainIndex < lotActif.quantite ? propositionLot(lotActif, 4, true) : null };
}

export async function GET() { return NextResponse.json(await lire()); }

export async function POST(request: Request) {
  const body = await request.json();
  const premierNunati = String(body.premierNunati ?? "").trim().toUpperCase();
  const quantite = Number(body.quantite);
  const premierNutrav = premierNunati.match(/(\d{4})$/)?.[1];
  if (!premierNutrav || !Number.isInteger(quantite) || quantite < 1) return NextResponse.json({ error: "Numéro national complet avec 4 chiffres finaux et quantité requis" }, { status: 400 });

  const nationaux = Array.from({ length: quantite }, (_, index) => numeroNationalDuLot(premierNunati, index));
  if (nationaux.some((numero) => !numero)) return NextResponse.json({ error: "La série nationale ne peut pas être calculée" }, { status: 400 });
  const travaux = nationaux.map((numero) => numero.slice(-4));
  if (new Set(nationaux).size !== quantite || new Set(travaux).size !== quantite) return NextResponse.json({ error: "La quantité dépasse la série de numéros de travail disponible" }, { status: 400 });

  const [animalUtilise, veauUtilise] = await Promise.all([
    prisma.animal.findFirst({ where: { OR: [{ nutrav: { in: travaux } }, { numeroNational: { in: nationaux } }] }, select: { nutrav: true, numeroNational: true } }),
    prisma.veauVelage.findFirst({ where: { OR: [{ nutrav: { in: travaux } }, { nunati: { in: nationaux } }] }, select: { nutrav: true, nunati: true } }),
  ]);
  if (animalUtilise || veauUtilise) return NextResponse.json({ error: `Un numéro du lot est déjà utilisé (${animalUtilise?.nutrav ?? veauUtilise?.nutrav ?? animalUtilise?.numeroNational ?? veauUtilise?.nunati})` }, { status: 409 });

  await prisma.$transaction([
    prisma.lotBoucles.updateMany({ where: { actif: true }, data: { actif: false } }),
    prisma.lotBoucles.create({ data: { reference: String(body.reference ?? "").trim() || null, premierNutrav, premierNunati, quantite, prochainIndex: 0, actif: true } }),
    prisma.exploitationConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton", identificationMode: "TRAVAIL_ET_NATIONAL", nutravNbChiffres: 4, nutravZerosGauche: true, propositionAutoNumero: true, serieCommuneSexes: true }, update: { identificationMode: "TRAVAIL_ET_NATIONAL", nutravNbChiffres: 4, nutravZerosGauche: true, propositionAutoNumero: true, serieCommuneSexes: true } }),
  ]);
  return NextResponse.json(await lire(), { status: 201 });
}

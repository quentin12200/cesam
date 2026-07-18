export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { propositionLot } from "@/lib/identification";

const MODES = ["TRAVAIL_SEUL", "TRAVAIL_ET_NATIONAL", "NATIONAL_OBLIGATOIRE", "CONNEXION_OFFICIELLE"];
const SERVICES = ["SYNEL", "AUTRE_LOGICIEL", "DECLARATION_DIRECTE", "AUCUN"];

async function lire() {
  const config = await prisma.exploitationConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton" }, update: {} });
  const lotActif = await prisma.lotBoucles.findFirst({ where: { actif: true }, orderBy: { createdAt: "desc" } });
  return { config, lotActif, proposition: lotActif && lotActif.prochainIndex < lotActif.quantite ? propositionLot(lotActif, config.nutravNbChiffres, config.nutravZerosGauche) : null };
}

export async function GET() {
  return NextResponse.json(await lire());
}

export async function PUT(request: Request) {
  const body = await request.json();
  const data = {
    identificationMode: MODES.includes(body.identificationMode) ? body.identificationMode : "TRAVAIL_ET_NATIONAL",
    nutravNbChiffres: Math.max(1, Math.min(10, Number(body.nutravNbChiffres) || 4)),
    nutravZerosGauche: body.nutravZerosGauche !== false,
    propositionAutoNumero: body.propositionAutoNumero !== false,
    serieCommuneSexes: body.serieCommuneSexes !== false,
    serviceDeclaration: SERVICES.includes(body.serviceDeclaration) ? body.serviceDeclaration : "AUCUN",
  };
  await prisma.exploitationConfig.upsert({ where: { id: "singleton" }, create: { id: "singleton", ...data }, update: data });
  return NextResponse.json(await lire());
}

export async function POST(request: Request) {
  const body = await request.json();
  const premierNutrav = String(body.premierNutrav ?? "").trim();
  const premierNunati = String(body.premierNunati ?? "").trim().toUpperCase();
  const quantite = Number(body.quantite);
  if (!/^\d+$/.test(premierNutrav) || !premierNunati || !Number.isInteger(quantite) || quantite < 1) {
    return NextResponse.json({ error: "Premier numéro de travail, numéro national et quantité requis" }, { status: 400 });
  }
  await prisma.$transaction([
    prisma.lotBoucles.updateMany({ where: { actif: true }, data: { actif: false } }),
    prisma.lotBoucles.create({ data: { reference: String(body.reference ?? "").trim() || null, premierNutrav, premierNunati, quantite, prochainIndex: 0, actif: true } }),
  ]);
  return NextResponse.json(await lire(), { status: 201 });
}

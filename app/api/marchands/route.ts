import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normaliserNom(value: string) {
  return value.trim().toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ");
}

export async function GET() {
  const [marchands, sorties, historiques] = await Promise.all([
    prisma.marchand.findMany({ orderBy: { nom: "asc" } }),
    prisma.sortie.findMany({ where: { acheteur: { not: null } }, select: { acheteur: true }, distinct: ["acheteur"] }),
    prisma.venteHistorique.findMany({ where: { acheteur: { not: null } }, select: { acheteur: true }, distinct: ["acheteur"] }),
  ]);
  const connus = new Set(marchands.map((marchand) => normaliserNom(marchand.nom)));
  const suggestions = [...new Set([...sorties, ...historiques]
    .map((vente) => vente.acheteur?.trim())
    .filter((nom): nom is string => Boolean(nom) && !nom!.startsWith("=")))]
    .filter((nom) => !connus.has(normaliserNom(nom)))
    .sort((a, b) => a.localeCompare(b, "fr"));
  return NextResponse.json({ marchands, suggestions });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const nom = typeof body.nom === "string" ? body.nom.trim().replace(/\s+/g, " ") : "";
  if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const existant = (await prisma.marchand.findMany()).find((marchand) => normaliserNom(marchand.nom) === normaliserNom(nom));
  if (existant) return NextResponse.json(existant);

  const marchand = await prisma.marchand.create({ data: { nom } });
  return NextResponse.json(marchand, { status: 201 });
}

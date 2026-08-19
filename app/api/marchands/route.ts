import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cleNomMarchand, formaterNomMarchand } from "@/lib/marchands";

export async function GET() {
  const [marchands, sorties, historiques] = await Promise.all([
    prisma.marchand.findMany({ orderBy: { nom: "asc" } }),
    prisma.sortie.findMany({ where: { acheteur: { not: null } }, select: { acheteur: true }, distinct: ["acheteur"] }),
    prisma.venteHistorique.findMany({ where: { acheteur: { not: null } }, select: { acheteur: true }, distinct: ["acheteur"] }),
  ]);
  const marchandsParCle = new Map<string, typeof marchands[number]>();
  for (const marchand of marchands) {
    const cle = cleNomMarchand(marchand.nom);
    if (!marchandsParCle.has(cle)) marchandsParCle.set(cle, { ...marchand, nom: formaterNomMarchand(marchand.nom) });
  }
  const marchandsAffiches = [...marchandsParCle.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const connus = new Set(marchandsParCle.keys());
  const suggestionsParCle = new Map<string, string>();
  for (const acheteur of [...sorties, ...historiques].map((vente) => vente.acheteur)) {
    if (!acheteur?.trim() || acheteur.trim().startsWith("=")) continue;
    const cle = cleNomMarchand(acheteur);
    if (!connus.has(cle) && !suggestionsParCle.has(cle)) suggestionsParCle.set(cle, formaterNomMarchand(acheteur));
  }
  const suggestions = [...suggestionsParCle.values()].sort((a, b) => a.localeCompare(b, "fr"));
  return NextResponse.json({ marchands: marchandsAffiches, suggestions });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const nom = typeof body.nom === "string" ? formaterNomMarchand(body.nom) : "";
  if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const tous = await prisma.marchand.findMany();
  const correspondants = tous.filter((marchand) => cleNomMarchand(marchand.nom) === cleNomMarchand(nom));
  if (correspondants.length > 0) {
    const principal = correspondants.find((marchand) => marchand.nom === nom) ?? correspondants[0];
    const doublons = correspondants.filter((marchand) => marchand.id !== principal.id).map((marchand) => marchand.id);
    const marchand = await prisma.$transaction(async (tx) => {
      if (doublons.length > 0) await tx.marchand.deleteMany({ where: { id: { in: doublons } } });
      return principal.nom === nom ? principal : tx.marchand.update({ where: { id: principal.id }, data: { nom } });
    });
    return NextResponse.json(marchand);
  }

  const marchand = await prisma.marchand.create({ data: { nom } });
  return NextResponse.json(marchand, { status: 201 });
}

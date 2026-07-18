import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const TYPES = new Set(["VOIE", "UNITE", "BASE_DOSAGE", "FREQUENCE"]);
const codeDe = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

export async function GET() {
  return NextResponse.json(await prisma.valeurReferentielPreconisation.findMany({ orderBy: [{ type: "asc" }, { libelle: "asc" }] }));
}

export async function POST(request: Request) {
  const body = await request.json();
  const type = String(body.type ?? "").toUpperCase();
  const libelle = String(body.libelle ?? "").trim();
  const code = codeDe(libelle);
  if (!TYPES.has(type) || !code) return NextResponse.json({ error: "Valeur invalide" }, { status: 400 });
  const existante = await prisma.valeurReferentielPreconisation.findUnique({ where: { type_code: { type, code } } });
  if (existante) return NextResponse.json(existante);
  return NextResponse.json(await prisma.valeurReferentielPreconisation.create({ data: { type, code, libelle } }), { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  return NextResponse.json(await prisma.valeurReferentielPreconisation.update({ where: { id: String(body.id) }, data: { actif: Boolean(body.actif), ...(body.libelle ? { libelle: String(body.libelle).trim() } : {}) } }));
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const rows = await prisma.venteHistorique.findMany({ orderBy: [{ annee: "asc" }, { date: "asc" }] });
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const row = await prisma.venteHistorique.create({
      data: {
        annee: parseInt(body.annee),
        typeAnimal: body.typeAnimal,
        typeVente: body.typeVente,
        nutrav: body.nutrav || null,
        sexe: body.sexe || null,
        poidsVif: body.poidsVif != null ? parseFloat(body.poidsVif) : null,
        prixKgVif: body.prixKgVif != null ? parseFloat(body.prixKgVif) : null,
        poidsCarc: body.poidsCarc != null ? parseFloat(body.poidsCarc) : null,
        prixKgCarc: body.prixKgCarc != null ? parseFloat(body.prixKgCarc) : null,
        acheteur: body.acheteur || null,
        date: new Date(body.date),
        total: body.total != null ? parseFloat(body.total) : null,
        notes: body.notes || null,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(row);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const medicaments = await prisma.medicament.findMany({ orderBy: { nom: "asc" } });
  return NextResponse.json(medicaments);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nom, dci, categorie, voie, dosagePourKg, uniteDosage, delaiAttenteViandeJ, prescriptionRequise } = body;
  if (!nom?.trim()) {
    return NextResponse.json({ error: "nom requis" }, { status: 400 });
  }
  try {
    const med = await prisma.medicament.create({
      data: {
        nom: nom.trim().toUpperCase(),
        dci: dci?.trim() || null,
        categorie: categorie ?? "AUTRE",
        voie: voie?.trim() || null,
        dosagePourKg: dosagePourKg ?? null,
        uniteDosage: uniteDosage?.trim() || "ml",
        delaiAttenteViandeJ: delaiAttenteViandeJ ?? null,
        prescriptionRequise: prescriptionRequise ?? false,
        actif: true,
      },
    });
    return NextResponse.json(med, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ce nom existe déjà" }, { status: 409 });
  }
}

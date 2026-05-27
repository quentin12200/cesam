import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const ordonnances = await prisma.ordonnance.findMany({
    orderBy: { date: "desc" },
    take: 100,
  });
  return NextResponse.json(ordonnances);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    date, numero, veterinaireNom, medicamentNom,
    dose, uniteDosage, voie, dureeJours, motif, animaux, notes,
  } = body;

  const ordonnance = await prisma.ordonnance.create({
    data: {
      date: date ? new Date(date) : new Date(),
      numero: numero?.trim() || null,
      veterinaireNom: veterinaireNom?.trim() || null,
      medicamentNom: medicamentNom?.trim() ?? "",
      dose: dose != null ? Number(dose) : null,
      uniteDosage: uniteDosage?.trim() || null,
      voie: voie?.trim() || null,
      dureeJours: dureeJours != null ? Number(dureeJours) : null,
      motif: motif?.trim() || null,
      animaux: animaux?.trim() || null,
      notes: notes?.trim() || null,
    },
  });

  return NextResponse.json(ordonnance, { status: 201 });
}

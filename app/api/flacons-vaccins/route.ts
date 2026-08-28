import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculerDateLimiteUtilisation, reliquatFlacon, resoudreRegleConservation } from "@/lib/vaccine-planner";

export async function GET() {
  const flacons = await prisma.flaconMedicamentOuvert.findMany({
    where: { statut: "OUVERT" },
    include: {
      medicament: { select: { nom: true } },
      conditionnement: { select: { quantiteFlacon: true, uniteFlacon: true, doses: true } },
      utilisations: { select: { dosesUtilisees: true } },
    },
    orderBy: { dateOuverture: "asc" },
  });
  return NextResponse.json(flacons.map((flacon) => ({
    ...flacon,
    dosesRestantes: reliquatFlacon(flacon.dosesInitiales, flacon.utilisations),
  })));
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const dosesInitiales = Number(body.dosesInitiales);
  const dateOuverture = new Date(body.dateOuverture);
  if (!body.medicamentId || !Number.isFinite(dosesInitiales) || dosesInitiales <= 0 || Number.isNaN(dateOuverture.getTime())) {
    return NextResponse.json({ error: "Médicament, date et nombre de doses valides requis" }, { status: 400 });
  }
  const medicament = await prisma.medicament.findUnique({ where: { id: body.medicamentId } });
  if (!medicament) return NextResponse.json({ error: "Médicament introuvable" }, { status: 404 });
  const conditionnement = body.conditionnementId
    ? await prisma.conditionnementMedicament.findFirst({ where: { id: body.conditionnementId, medicamentId: body.medicamentId } })
    : null;
  if (body.conditionnementId && !conditionnement) {
    return NextResponse.json({ error: "Conditionnement incompatible" }, { status: 400 });
  }
  const regle = resoudreRegleConservation(medicament, conditionnement);
  const dateLimiteUtilisation = calculerDateLimiteUtilisation(dateOuverture, regle);
  const flacon = await prisma.flaconMedicamentOuvert.create({ data: {
    medicamentId: body.medicamentId,
    conditionnementId: conditionnement?.id ?? null,
    dateOuverture,
    dosesInitiales,
    conservationJours: regle.jours,
    dateLimiteUtilisation,
    conditionConservation: regle.condition,
    sourceConservation: regle.source,
    numeroLot: typeof body.numeroLot === "string" && body.numeroLot.trim() ? body.numeroLot.trim() : null,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
  }});
  return NextResponse.json(flacon, { status: 201 });
}

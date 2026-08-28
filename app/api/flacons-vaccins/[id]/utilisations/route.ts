import { differenceInCalendarDays } from "date-fns";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reliquatFlacon } from "@/lib/vaccine-planner";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: flaconId } = await params;
  const body = await request.json();
  const dosesUtilisees = Number(body.dosesUtilisees);
  const date = new Date(body.date);
  if (!Number.isFinite(dosesUtilisees) || dosesUtilisees <= 0 || Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "Date et doses utilisées valides requises" }, { status: 400 });
  }
  const flacon = await prisma.flaconMedicamentOuvert.findUnique({
    where: { id: flaconId },
    include: { utilisations: { select: { dosesUtilisees: true } } },
  });
  if (!flacon) return NextResponse.json({ error: "Flacon introuvable" }, { status: 404 });
  const restantes = reliquatFlacon(flacon.dosesInitiales, flacon.utilisations);
  if (dosesUtilisees > restantes) return NextResponse.json({ error: "Reliquat insuffisant" }, { status: 400 });
  if (differenceInCalendarDays(date, flacon.dateOuverture) < 0) {
    return NextResponse.json({ error: "Utilisation antérieure à l'ouverture" }, { status: 400 });
  }
  if (differenceInCalendarDays(date, flacon.dateOuverture) > 0
    && (!flacon.dateLimiteUtilisation || differenceInCalendarDays(date, flacon.dateLimiteUtilisation) > 0)) {
    return NextResponse.json({ error: "Reliquat expiré ou conservation inconnue" }, { status: 400 });
  }
  if (body.vaccinationId) {
    const vaccination = await prisma.vaccination.findUnique({ where: { id: body.vaccinationId }, select: { id: true } });
    if (!vaccination) return NextResponse.json({ error: "Vaccination introuvable" }, { status: 404 });
  }
  const utilisation = await prisma.utilisationFlaconVaccin.create({ data: {
    flaconId,
    vaccinationId: body.vaccinationId || null,
    date,
    dosesUtilisees,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
  }});
  return NextResponse.json(utilisation, { status: 201 });
}

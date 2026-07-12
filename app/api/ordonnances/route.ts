import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

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
    dose, uniteDosage, voie, frequence, dureeJours, motif, animaux, notes, photoUrl,
    delaiAttenteViandeJ, delaiAttenteLaitJ, precautions, rappels,
  } = body;

  const trimmedNumero = numero?.trim() || null;

  if (trimmedNumero) {
    const existante = await prisma.ordonnance.findFirst({ where: { numero: trimmedNumero } });
    if (existante) {
      const updated = await prisma.ordonnance.update({
        where: { id: existante.id },
        data: {
          photoUrl: photoUrl ?? existante.photoUrl,
          frequence: existante.frequence ?? frequence?.trim() ?? null,
          delaiAttenteViandeJ: existante.delaiAttenteViandeJ ?? (delaiAttenteViandeJ != null ? Number(delaiAttenteViandeJ) : null),
          delaiAttenteLaitJ: existante.delaiAttenteLaitJ ?? (delaiAttenteLaitJ != null ? Number(delaiAttenteLaitJ) : null),
          precautions: existante.precautions ?? precautions?.trim() ?? null,
          rappels: existante.rappels ?? rappels?.trim() ?? null,
        },
      });
      return NextResponse.json({ ...updated, _reused: true }, { status: 200 });
    }
  }

  const ordonnance = await prisma.ordonnance.create({
    data: {
      date: date ? new Date(date) : new Date(),
      numero: trimmedNumero,
      veterinaireNom: veterinaireNom?.trim() || null,
      medicamentNom: medicamentNom?.trim() ?? "",
      dose: dose != null ? Number(dose) : null,
      uniteDosage: uniteDosage?.trim() || null,
      voie: voie?.trim() || null,
      frequence: frequence?.trim() || null,
      dureeJours: dureeJours != null ? Number(dureeJours) : null,
      motif: motif?.trim() || null,
      animaux: animaux?.trim() || null,
      notes: notes?.trim() || null,
      photoUrl: photoUrl ?? null,
      delaiAttenteViandeJ: delaiAttenteViandeJ != null ? Number(delaiAttenteViandeJ) : null,
      delaiAttenteLaitJ: delaiAttenteLaitJ != null ? Number(delaiAttenteLaitJ) : null,
      precautions: precautions?.trim() || null,
      rappels: rappels?.trim() || null,
    },
  });

  const desc = `Ordonnance ${ordonnance.medicamentNom || ''} créée`;
  let undoId = "";
  try {
    undoId = await logAction("CREATE_ORDONNANCE", desc, { op: "delete", model: "ordonnance", id: ordonnance.id });
  } catch {}

  return NextResponse.json({ ...ordonnance, _undoId: undoId, _undoDesc: desc, _reused: false }, { status: 201 });
}

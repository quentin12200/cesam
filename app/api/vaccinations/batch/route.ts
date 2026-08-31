import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function POST(request: NextRequest) {
  try {
    const { items, date, voie } = await request.json();
    type VaccinationBatchItem = {
      nutrav: string;
      vaccin: string;
      dose?: number | null;
      medicamentId?: string | null;
      protocoleId?: string | null;
      etapeProtocoleId?: string | null;
      gestationId?: string | null;
      typeInjection?: string | null;
    };
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items requis" }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: "date requise" }, { status: 400 });
    }
    if (items.some((item: VaccinationBatchItem) => item.dose != null && !Number.isFinite(Number(item.dose)))) {
      return NextResponse.json({ error: "dose invalide" }, { status: 400 });
    }

    const nutravs = [...new Set(items.map((i: VaccinationBatchItem) => i.nutrav))];
    const animaux = await prisma.animal.findMany({
      where: { nutrav: { in: nutravs } },
      select: { id: true, nutrav: true },
    });
    const nutravToId = new Map(animaux.map((a) => [a.nutrav, a.id]));

    const resolvedDate = new Date(date);
    const resolvedVoie: string | null = voie?.trim() || null;
    const now = new Date();

    const data = items.map((item: VaccinationBatchItem) => {
      const animalId = nutravToId.get(item.nutrav);
      if (!animalId) throw new Error(`Animal ${item.nutrav} non trouvé`);
      return {
        animalId,
        vaccin: item.vaccin,
        date: resolvedDate,
        voie: resolvedVoie,
        dose: item.dose == null ? null : Number(item.dose),
        medicamentId: item.medicamentId || null,
        protocoleId: item.protocoleId || null,
        etapeProtocoleId: item.etapeProtocoleId || null,
        gestationId: item.gestationId || null,
        typeInjection: item.typeInjection || null,
        updatedAt: now,
      };
    });

    const vaccinations = await Promise.all(
      data.map((d) => prisma.vaccination.create({ data: d }))
    );

    const desc = `Session vaccination : ${vaccinations.length} animal(s) vacciné(s)`;
    let undoId = "";
    try {
      undoId = await logAction(
        "BATCH_VACCINATION",
        desc,
        vaccinations.map((v) => ({ op: "delete" as const, model: "vaccination", id: v.id }))
      );
    } catch {}

    return NextResponse.json({ count: vaccinations.length, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch (err) {
    console.error("POST /api/vaccinations/batch error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nutrav, animalId, vaccin, date, voie, dose, notes } = body;

    if (!vaccin || !date) {
      return NextResponse.json({ error: "vaccin et date sont requis" }, { status: 400 });
    }

    let resolvedAnimalId = animalId;

    if (!resolvedAnimalId && nutrav) {
      const animal = await prisma.animal.findUnique({ where: { nutrav } });
      if (!animal) {
        return NextResponse.json({ error: `Animal avec NUTRAV ${nutrav} non trouvé` }, { status: 404 });
      }
      resolvedAnimalId = animal.id;
    }

    if (!resolvedAnimalId) {
      return NextResponse.json({ error: "nutrav ou animalId requis" }, { status: 400 });
    }

    const vaccination = await prisma.vaccination.create({
      data: {
        animalId: resolvedAnimalId,
        vaccin,
        date: new Date(date),
        voie: voie ?? null,
        dose: dose ?? null,
        notes: notes ?? null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(vaccination, { status: 201 });
  } catch (err) {
    console.error("POST /api/vaccinations error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

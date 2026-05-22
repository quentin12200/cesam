import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { animalId, date, type, groupage, taureauId, tentative } = body;

    if (!animalId || !date || !type) {
      return NextResponse.json({ error: "Champs manquants: animalId, date, type requis" }, { status: 400 });
    }

    const saillie = await prisma.saillie.create({
      data: {
        animalId,
        date: new Date(date),
        type,
        groupage: groupage ?? false,
        tentative: tentative ?? 1,
        taureauId: taureauId ?? null,
        updatedAt: new Date(),
      },
    });

    // Créer une gestation associée en état GRIS
    await prisma.gestation.create({
      data: {
        saillieId: saillie.id,
        etat: "GRIS",
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(saillie, { status: 201 });
  } catch (err) {
    console.error("POST /api/saillies error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nutrav, date, poids } = body;

    if (!nutrav || !date || poids == null) {
      return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
    }

    const animal = await prisma.animal.findUnique({ where: { nutrav } });
    if (!animal) {
      return NextResponse.json({ error: "Animal non trouvé" }, { status: 404 });
    }

    const pesee = await prisma.pesee.create({
      data: {
        animalId: animal.id,
        date: new Date(date),
        poids: parseFloat(String(poids)),
      },
    });

    return NextResponse.json({ success: true, pesee });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

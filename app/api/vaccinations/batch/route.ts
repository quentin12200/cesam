import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { items, date, voie } = await request.json();
    // items: { nutrav: string; vaccin: string }[]
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items requis" }, { status: 400 });
    }
    if (!date) {
      return NextResponse.json({ error: "date requise" }, { status: 400 });
    }

    const nutravs = [...new Set(items.map((i: { nutrav: string }) => i.nutrav))];
    const animaux = await prisma.animal.findMany({
      where: { nutrav: { in: nutravs } },
      select: { id: true, nutrav: true },
    });
    const nutravToId = new Map(animaux.map((a) => [a.nutrav, a.id]));

    const resolvedDate = new Date(date);
    const resolvedVoie: string = voie ?? "IM";
    const now = new Date();

    const data = items.map((item: { nutrav: string; vaccin: string }) => {
      const animalId = nutravToId.get(item.nutrav);
      if (!animalId) throw new Error(`Animal ${item.nutrav} non trouvé`);
      return {
        animalId,
        vaccin: item.vaccin,
        date: resolvedDate,
        voie: resolvedVoie,
        updatedAt: now,
      };
    });

    const result = await prisma.vaccination.createMany({ data });
    return NextResponse.json({ count: result.count }, { status: 201 });
  } catch (err) {
    console.error("POST /api/vaccinations/batch error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

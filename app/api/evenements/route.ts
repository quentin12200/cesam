import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { animalId, type, date, description } = await request.json();
    if (!animalId || !type || !date) {
      return NextResponse.json({ error: "animalId, type et date requis" }, { status: 400 });
    }
    const evt = await prisma.evenementSanitaire.create({
      data: {
        animalId,
        type: type.trim(),
        date: new Date(date),
        description: description?.trim() || null,
        updatedAt: new Date(),
      },
    });
    return NextResponse.json(evt, { status: 201 });
  } catch (err) {
    console.error("POST /api/evenements error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

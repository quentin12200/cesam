import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const { animalId, date, notes } = await request.json();
    if (!animalId || !date) {
      return NextResponse.json({ error: "animalId et date requis" }, { status: 400 });
    }
    const chaleur = await prisma.chaleur.create({
      data: { animalId, date: new Date(date), notes: notes?.trim() || null, updatedAt: new Date() },
    });
    return NextResponse.json(chaleur, { status: 201 });
  } catch (err) {
    console.error("POST /api/chaleurs error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

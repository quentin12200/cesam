import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { action, nutrav, nom } = body;

    if (action === "attribuer") {
      if (!nutrav?.trim()) {
        return NextResponse.json({ error: "nutrav requis" }, { status: 400 });
      }
      const capteur = await prisma.capteurVelage.update({
        where: { id },
        data: {
          actif: true,
          animalNutrav: nutrav.trim(),
          animalNom: nom?.trim() || null,
          dateAttribution: new Date(),
        },
      });
      return NextResponse.json(capteur);
    }

    if (action === "liberer") {
      const capteur = await prisma.capteurVelage.update({
        where: { id },
        data: {
          actif: false,
          animalNutrav: null,
          animalNom: null,
          dateAttribution: null,
        },
      });
      return NextResponse.json(capteur);
    }

    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  } catch (err) {
    console.error("PATCH /api/capteurs/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

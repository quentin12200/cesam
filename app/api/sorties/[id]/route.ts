import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const sortie = await prisma.sortie.findUnique({ where: { id } });
    if (!sortie) {
      return NextResponse.json({ error: "Sortie introuvable" }, { status: 404 });
    }

    await prisma.sortie.delete({ where: { id } });

    // Remettre l'animal en ACTIF seulement s'il n'a plus d'autres sorties
    const autresSorties = await prisma.sortie.count({
      where: { animalId: sortie.animalId },
    });
    if (autresSorties === 0) {
      await prisma.animal.update({
        where: { id: sortie.animalId },
        data: { statut: "ACTIF", updatedAt: new Date() },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sorties/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

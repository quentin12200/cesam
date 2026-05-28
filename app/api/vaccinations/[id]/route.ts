import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const vaccination = await prisma.vaccination.findUnique({
      where: { id },
      include: { animal: { select: { nutrav: true } } },
    });
    if (!vaccination) {
      return NextResponse.json({ error: "Non trouvé" }, { status: 404 });
    }

    await prisma.vaccination.delete({ where: { id } });

    const desc = `Vaccination ${vaccination.vaccin} supprimée pour ${vaccination.animal.nutrav}`;
    let undoId = "";
    try {
      undoId = await logAction("DELETE_VACCINATION", desc, {
        op: "create",
        model: "vaccination",
        data: {
          id: vaccination.id,
          animalId: vaccination.animalId,
          vaccin: vaccination.vaccin,
          date: vaccination.date,
          voie: vaccination.voie,
          dose: vaccination.dose,
          notes: vaccination.notes,
          statut: vaccination.statut,
          updatedAt: new Date(),
        },
      });
    } catch {}

    return NextResponse.json({ ok: true, _undoId: undoId, _undoDesc: desc });
  } catch (err) {
    console.error("DELETE /api/vaccinations/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

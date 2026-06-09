import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const velage = await prisma.velage.findUnique({
      where: { id },
      include: {
        veau: { select: { nutrav: true } },
        vache: { select: { nutrav: true, tarieFaite: true } },
        gestation: { select: { id: true } },
      },
    });

    if (!velage) {
      return NextResponse.json({ error: "Vêlage introuvable" }, { status: 404 });
    }

    await prisma.velage.delete({ where: { id } });

    // Restaurer le mereId/danais du veau
    if (velage.veau) {
      await prisma.animal.update({
        where: { nutrav: velage.veau.nutrav },
        data: { mereId: null, danais: null as unknown as undefined },
      });
    }

    // Rouvrir la gestation
    if (velage.gestation) {
      await prisma.gestation.update({
        where: { id: velage.gestation.id },
        data: { etat: "VERT" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/velages/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

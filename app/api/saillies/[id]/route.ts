import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const saillie = await prisma.saillie.findUnique({
      where: { id },
      include: { gestation: { include: { velage: true } } },
    });

    if (!saillie) {
      return NextResponse.json({ error: "Saillie introuvable" }, { status: 404 });
    }

    if (saillie.gestation?.velage) {
      return NextResponse.json(
        { error: "Impossible de supprimer : un vêlage est déjà enregistré pour cette saillie" },
        { status: 400 }
      );
    }

    if (saillie.gestation) {
      await prisma.gestation.delete({ where: { id: saillie.gestation.id } });
    }

    await prisma.saillie.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/saillies/[id] error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

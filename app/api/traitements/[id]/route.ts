import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { statut, notes, dureeJours, veterinaire } = body;

  try {
    const traitement = await prisma.traitement.update({
      where: { id },
      data: {
        ...(statut !== undefined && { statut }),
        ...(notes !== undefined && { notes }),
        ...(dureeJours !== undefined && { dureeJours }),
        ...(veterinaire !== undefined && { veterinaire }),
      },
    });
    return NextResponse.json(traitement);
  } catch {
    return NextResponse.json({ error: "Traitement non trouvé" }, { status: 404 });
  }
}

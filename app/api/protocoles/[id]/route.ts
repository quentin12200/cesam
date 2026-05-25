import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    label, actif, ageMinJours, urgenceJours,
    delaiRappelJours, urgenceRappelJours, obligatoireVente, ordre,
  } = body;

  try {
    const protocole = await prisma.protocoleVaccin.update({
      where: { id },
      data: {
        ...(label !== undefined && { label: label.trim() }),
        ...(actif !== undefined && { actif }),
        ...(ageMinJours !== undefined && { ageMinJours }),
        ...(urgenceJours !== undefined && { urgenceJours }),
        ...(delaiRappelJours !== undefined && { delaiRappelJours }),
        ...(urgenceRappelJours !== undefined && { urgenceRappelJours }),
        ...(obligatoireVente !== undefined && { obligatoireVente }),
        ...(ordre !== undefined && { ordre }),
      },
    });
    return NextResponse.json(protocole);
  } catch {
    return NextResponse.json({ error: "Protocole non trouvé" }, { status: 404 });
  }
}

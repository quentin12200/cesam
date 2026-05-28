import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const {
    label, actif, ageMinJours, urgenceJours,
    delaiRappelJours, urgenceRappelJours, obligatoireVente, ordre,
    voiePrimo, voieRappel, rappelAnnuel,
  } = body;

  const prev = await prisma.protocoleVaccin.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Protocole non trouvé" }, { status: 404 });

  const prevFields: Record<string, unknown> = {};
  if (label !== undefined) prevFields.label = prev.label;
  if (actif !== undefined) prevFields.actif = prev.actif;
  if (ageMinJours !== undefined) prevFields.ageMinJours = prev.ageMinJours;
  if (urgenceJours !== undefined) prevFields.urgenceJours = prev.urgenceJours;
  if (delaiRappelJours !== undefined) prevFields.delaiRappelJours = prev.delaiRappelJours;
  if (urgenceRappelJours !== undefined) prevFields.urgenceRappelJours = prev.urgenceRappelJours;
  if (obligatoireVente !== undefined) prevFields.obligatoireVente = prev.obligatoireVente;
  if (ordre !== undefined) prevFields.ordre = prev.ordre;
  if (voiePrimo !== undefined) prevFields.voiePrimo = (prev as Record<string, unknown>).voiePrimo;
  if (voieRappel !== undefined) prevFields.voieRappel = (prev as Record<string, unknown>).voieRappel;
  if (rappelAnnuel !== undefined) prevFields.rappelAnnuel = (prev as Record<string, unknown>).rappelAnnuel;

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
        ...(voiePrimo !== undefined && { voiePrimo }),
        ...(voieRappel !== undefined && { voieRappel }),
        ...(rappelAnnuel !== undefined && { rappelAnnuel }),
      },
    });

    const desc = `Protocole '${prev.label}' mis à jour`;
    let undoId = "";
    try {
      undoId = await logAction("PATCH_PROTOCOLE", desc, { op: "update", model: "protocoleVaccin", where: { id }, data: prevFields });
    } catch {}

    return NextResponse.json({ ...protocole, _undoId: undoId, _undoDesc: desc });
  } catch {
    return NextResponse.json({ error: "Protocole non trouvé" }, { status: 404 });
  }
}

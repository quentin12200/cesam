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
    voiePrimo, voieRappel, rappelAnnuel, description, categories, sexeCible, stadeReproduction, gestante, rangVelageMin, rangVelageMax, lotCible, ageMaxJours, etapes,
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
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(categories !== undefined && { categoriesJson: JSON.stringify(categories) }),
        ...(sexeCible !== undefined && { sexeCible: sexeCible || null }), ...(stadeReproduction !== undefined && { stadeReproduction: stadeReproduction || null }),
        ...(gestante !== undefined && { gestante }), ...(rangVelageMin !== undefined && { rangVelageMin }), ...(rangVelageMax !== undefined && { rangVelageMax }),
        ...(lotCible !== undefined && { lotCible: lotCible || null }), ...(ageMaxJours !== undefined && { ageMaxJours }),
      },
    });
    if (Array.isArray(etapes)) {
      await prisma.etapeProtocoleVaccin.deleteMany({ where: { protocoleId: id } });
      for (const [index, e] of etapes.entries()) await prisma.etapeProtocoleVaccin.create({ data: { protocoleId: id, label: e.label, ordre: index, cycle: e.cycle || "INITIAL", reference: e.reference || "NAISSANCE", debutValeur: Number(e.debutValeur) || 0, debutUnite: e.debutUnite || "JOUR", debutPosition: e.debutPosition || "APRES", finValeur: Number(e.finValeur) || 0, finUnite: e.finUnite || "JOUR", finPosition: e.finPosition || "APRES", recurrenceMois: e.recurrenceMois ? Number(e.recurrenceMois) : null, obligatoire: e.obligatoire !== false, medicaments: { create: (e.medicaments || []).filter((m: any) => m.medicamentId).map((m: any) => ({ medicamentId: m.medicamentId, voie: m.voie || null, preconisationId: m.preconisationId || null, alternative: Boolean(m.alternative) })) } } });
    }

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

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.protocoleVaccin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

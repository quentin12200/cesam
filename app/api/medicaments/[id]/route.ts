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
    nom, dci, forme, categorie, voie, dosagePourKg, uniteDosage,
    delaiAttenteViandeJ, delaiAttenteLaitJ, prescriptionRequise, actif, commentaire,
    stockActuel, stockUnite, stockSeuilAlert, favori, actions,
  } = body;

  const prev = await prisma.medicament.findUnique({ where: { id } });
  if (!prev) return NextResponse.json({ error: "Médicament non trouvé" }, { status: 404 });

  const prevFields: Record<string, unknown> = {};
  if (nom !== undefined) prevFields.nom = prev.nom;
  if (dci !== undefined) prevFields.dci = prev.dci;
  if (forme !== undefined) prevFields.forme = prev.forme;
  if (categorie !== undefined) prevFields.categorie = prev.categorie;
  if (voie !== undefined) prevFields.voie = prev.voie;
  if (dosagePourKg !== undefined) prevFields.dosagePourKg = prev.dosagePourKg;
  if (uniteDosage !== undefined) prevFields.uniteDosage = prev.uniteDosage;
  if (delaiAttenteViandeJ !== undefined) prevFields.delaiAttenteViandeJ = prev.delaiAttenteViandeJ;
  if (delaiAttenteLaitJ !== undefined) prevFields.delaiAttenteLaitJ = prev.delaiAttenteLaitJ;
  if (prescriptionRequise !== undefined) prevFields.prescriptionRequise = prev.prescriptionRequise;
  if (actif !== undefined) prevFields.actif = prev.actif;
  if (commentaire !== undefined) prevFields.commentaire = prev.commentaire;
  if (stockActuel !== undefined) prevFields.stockActuel = prev.stockActuel;
  if (stockUnite !== undefined) prevFields.stockUnite = prev.stockUnite;
  if (stockSeuilAlert !== undefined) prevFields.stockSeuilAlert = prev.stockSeuilAlert;
  if (favori !== undefined) prevFields.favori = prev.favori;
  if (actions !== undefined) prevFields.actions = prev.actions;

  try {
    const med = await prisma.medicament.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom: nom.trim().toUpperCase() }),
        ...(dci !== undefined && { dci: dci?.trim() || null }),
        ...(forme !== undefined && { forme: forme?.trim() || null }),
        ...(categorie !== undefined && { categorie }),
        ...(voie !== undefined && { voie: voie?.trim() || null }),
        ...(dosagePourKg !== undefined && { dosagePourKg }),
        ...(uniteDosage !== undefined && { uniteDosage: uniteDosage?.trim() || null }),
        ...(delaiAttenteViandeJ !== undefined && { delaiAttenteViandeJ }),
        ...(delaiAttenteLaitJ !== undefined && { delaiAttenteLaitJ }),
        ...(prescriptionRequise !== undefined && { prescriptionRequise }),
        ...(actif !== undefined && { actif }),
        ...(commentaire !== undefined && { commentaire: commentaire?.trim() || null }),
        ...(stockActuel !== undefined && { stockActuel: stockActuel != null ? Number(stockActuel) : null }),
        ...(stockUnite !== undefined && { stockUnite: stockUnite?.trim() || null }),
        ...(stockSeuilAlert !== undefined && { stockSeuilAlert: stockSeuilAlert != null ? Number(stockSeuilAlert) : null }),
        ...(favori !== undefined && { favori: Boolean(favori) }),
        ...(actions !== undefined && { actions: actions?.trim() || null }),
      },
    });

    const desc = `Médicament '${prev.nom}' mis à jour`;
    let undoId = "";
    try {
      undoId = await logAction("PATCH_MEDICAMENT", desc, { op: "update", model: "medicament", where: { id }, data: prevFields });
    } catch {}

    return NextResponse.json({ ...med, _undoId: undoId, _undoDesc: desc });
  } catch {
    return NextResponse.json({ error: "Médicament non trouvé" }, { status: 404 });
  }
}

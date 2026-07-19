import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROTOCOLES } from "@/lib/utils";
import { logAction } from "@/lib/action-log";

export async function GET() {
  let protocoles = await prisma.protocoleVaccin.findMany({
    orderBy: { ordre: "asc" },
    include: { etapes: { include: { medicaments: { include: { medicament: true } } }, orderBy: { ordre: "asc" } } },
  });

  // Seed defaults if table is empty
  if (protocoles.length === 0) {
    await prisma.protocoleVaccin.createMany({
      data: DEFAULT_PROTOCOLES.map((p) => ({
        id: p.id,
        nom: p.nom,
        label: p.label,
        ordre: p.ordre,
        ageMinJours: p.ageMinJours,
        urgenceJours: p.urgenceJours,
        estRappel: p.estRappel,
        primoNom: p.primoNom,
        delaiRappelJours: p.delaiRappelJours,
        urgenceRappelJours: p.urgenceRappelJours,
        obligatoireVente: p.obligatoireVente,
        actif: p.actif,
      })),
    });
    protocoles = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" }, include: { etapes: { include: { medicaments: { include: { medicament: true } } }, orderBy: { ordre: "asc" } } } });
  }

  return NextResponse.json(protocoles);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nom, label, ordre, ageMinJours, ageMaxJours, urgenceJours, estRappel, primoNom, delaiRappelJours, urgenceRappelJours, obligatoireVente, description, categories, sexeCible, stadeReproduction, gestante, rangVelageMin, rangVelageMax, lotCible, etapes } = body;
  if (!nom?.trim() || !label?.trim()) {
    return NextResponse.json({ error: "nom et label requis" }, { status: 400 });
  }
  try {
    const protocole = await prisma.protocoleVaccin.create({
      data: {
        nom: nom.trim().toUpperCase(),
        label: label.trim(),
        ordre: ordre ?? 99,
        ageMinJours: ageMinJours ?? 0,
        ageMaxJours: ageMaxJours ?? null,
        urgenceJours: urgenceJours ?? null,
        estRappel: estRappel ?? false,
        primoNom: primoNom?.trim() || null,
        delaiRappelJours: delaiRappelJours ?? null,
        urgenceRappelJours: urgenceRappelJours ?? null,
        obligatoireVente: obligatoireVente ?? false,
        description: description?.trim() || null,
        categoriesJson: Array.isArray(categories) ? JSON.stringify(categories) : null,
        sexeCible: sexeCible || null, stadeReproduction: stadeReproduction || null, gestante: gestante ?? null,
        rangVelageMin: rangVelageMin ?? null, rangVelageMax: rangVelageMax ?? null, lotCible: lotCible || null,
        etapes: { create: (Array.isArray(etapes) ? etapes : []).map((e: any, index: number) => ({ label: e.label, ordre: index, cycle: e.cycle || "INITIAL", reference: e.reference || "NAISSANCE", debutValeur: Number(e.debutValeur) || 0, debutUnite: e.debutUnite || "JOUR", debutPosition: e.debutPosition || "APRES", finValeur: Number(e.finValeur) || 0, finUnite: e.finUnite || "JOUR", finPosition: e.finPosition || "APRES", recurrenceMois: e.recurrenceMois ? Number(e.recurrenceMois) : null, obligatoire: e.obligatoire !== false, medicaments: { create: (e.medicaments || []).filter((m: any) => m.medicamentId).map((m: any) => ({ medicamentId: m.medicamentId, voie: m.voie || null, preconisationId: m.preconisationId || null, alternative: Boolean(m.alternative) })) } })) },
        actif: true,
      },
    });
    const desc = `Protocole '${protocole.label}' créé`;
    let undoId = "";
    try {
      undoId = await logAction("CREATE_PROTOCOLE", desc, { op: "delete", model: "protocoleVaccin", id: protocole.id });
    } catch {}

    return NextResponse.json({ ...protocole, _undoId: undoId, _undoDesc: desc }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ce nom existe déjà" }, { status: 409 });
  }
}

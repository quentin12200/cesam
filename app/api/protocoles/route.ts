import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PROTOCOLES } from "@/lib/utils";

export async function GET() {
  let protocoles = await prisma.protocoleVaccin.findMany({
    orderBy: { ordre: "asc" },
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
    protocoles = await prisma.protocoleVaccin.findMany({ orderBy: { ordre: "asc" } });
  }

  return NextResponse.json(protocoles);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { nom, label, ordre, ageMinJours, urgenceJours, estRappel, primoNom, delaiRappelJours, urgenceRappelJours, obligatoireVente } = body;
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
        urgenceJours: urgenceJours ?? null,
        estRappel: estRappel ?? false,
        primoNom: primoNom?.trim() || null,
        delaiRappelJours: delaiRappelJours ?? null,
        urgenceRappelJours: urgenceRappelJours ?? null,
        obligatoireVente: obligatoireVente ?? false,
        actif: true,
      },
    });
    return NextResponse.json(protocole, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Ce nom existe déjà" }, { status: 409 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const medicamentId = searchParams.get("medicamentId");
  const statut = searchParams.get("statut");

  const preconisations = await prisma.preconisation.findMany({
    where: {
      ...(medicamentId ? { medicamentId } : {}),
      ...(statut ? { statut } : {}),
    },
    include: { medicament: { select: { nom: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(preconisations);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    medicamentId, indicationMotif, categorieAnimaux, agePoidsConcerne,
    dose, unite, doseBase, voie, frequence, dureeValeur, dureeUnite, nombreAdministrations,
    precautions, delaiAttenteViandeJ, delaiAttenteLaitTraites, source, statut,
  } = body;

  if (!medicamentId) {
    return NextResponse.json({ error: "medicamentId requis" }, { status: 400 });
  }

  const medicament = await prisma.medicament.findUnique({ where: { id: medicamentId }, select: { nom: true } });
  if (!medicament) return NextResponse.json({ error: "Médicament non trouvé" }, { status: 404 });

  const preconisation = await prisma.preconisation.create({
    data: {
      medicamentId,
      indicationMotif: indicationMotif?.trim() || null,
      categorieAnimaux: categorieAnimaux?.trim() || null,
      agePoidsConcerne: agePoidsConcerne?.trim() || null,
      dose: dose != null && dose !== "" ? Number(dose) : null,
      unite: unite?.trim() || null,
      doseBase: doseBase || null,
      voie: voie?.trim() || null,
      frequence: frequence?.trim() || null,
      dureeValeur: frequence === "DOSE_UNIQUE" ? null : dureeValeur != null && dureeValeur !== "" ? Number(dureeValeur) : null,
      dureeUnite: frequence === "DOSE_UNIQUE" ? null : dureeUnite?.trim() || null,
      nombreAdministrations: frequence === "DOSE_UNIQUE" ? 1 : nombreAdministrations != null && nombreAdministrations !== "" ? Number(nombreAdministrations) : null,
      precautions: precautions?.trim() || null,
      delaiAttenteViandeJ: delaiAttenteViandeJ != null && delaiAttenteViandeJ !== "" ? Number(delaiAttenteViandeJ) : null,
      delaiAttenteLaitTraites: delaiAttenteLaitTraites != null && delaiAttenteLaitTraites !== "" ? Number(delaiAttenteLaitTraites) : null,
      source: source?.trim() || "Saisie manuelle",
      statut: statut || "A_VERIFIER",
    },
  });

  const desc = `Préconisation ajoutée pour ${medicament.nom}`;
  let undoId = "";
  try {
    undoId = await logAction("CREATE_PRECONISATION", desc, { op: "delete", model: "preconisation", id: preconisation.id });
  } catch {}

  return NextResponse.json({ ...preconisation, _undoId: undoId, _undoDesc: desc }, { status: 201 });
}

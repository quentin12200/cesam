import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    documentUrl,
    reponseBrute,
    propositionInitiale,
    modele,
    versionPrompt,
    analyseLe,
  } = body;

  if (!documentUrl || typeof reponseBrute !== "string" || !propositionInitiale || !modele || !versionPrompt) {
    return NextResponse.json({ error: "Analyse incomplète" }, { status: 400 });
  }

  const dateAnalyse = analyseLe ? new Date(analyseLe) : new Date();
  const extraction = await prisma.extractionOrdonnance.create({
    data: {
      statut: "A_VERIFIER",
      documentUrl,
      reponseBrute,
      propositionInitiale: JSON.stringify(propositionInitiale),
      modele,
      versionPrompt,
      analyseLe: Number.isNaN(dateAnalyse.getTime()) ? new Date() : dateAnalyse,
    },
  });

  return NextResponse.json({ id: extraction.id, statut: extraction.statut }, { status: 201 });
}

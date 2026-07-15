import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedEmail } from "@/lib/cesam-auth";

export async function POST(request: NextRequest) {
  if (!(await getAuthorizedEmail(request.headers.get("cookie")))) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const body = await request.json();
  const {
    documentUrl,
    documentUrls,
    reponseBrute,
    propositionInitiale,
    modele,
    versionPrompt,
    analyseLe,
  } = body;

  if (!documentUrl || typeof reponseBrute !== "string" || !propositionInitiale || !modele || !versionPrompt) {
    return NextResponse.json({ error: "Analyse incomplète" }, { status: 400 });
  }

  const pages = Array.isArray(documentUrls) && documentUrls.length > 0
    ? documentUrls.filter((u: unknown): u is string => typeof u === "string")
    : [documentUrl];

  const dateAnalyse = analyseLe ? new Date(analyseLe) : new Date();
  const extraction = await prisma.extractionOrdonnance.create({
    data: {
      statut: "A_VERIFIER",
      documentUrl,
      documentUrls: JSON.stringify(pages),
      reponseBrute,
      propositionInitiale: JSON.stringify(propositionInitiale),
      modele,
      versionPrompt,
      analyseLe: Number.isNaN(dateAnalyse.getTime()) ? new Date() : dateAnalyse,
    },
  });

  return NextResponse.json({ id: extraction.id, statut: extraction.statut }, { status: 201 });
}

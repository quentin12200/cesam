import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthorizedEmail } from "@/lib/cesam-auth";
import {
  logOrdonnanceScanFailure,
  ordonnanceScanUserMessage,
} from "@/lib/ordonnance-scan-diagnostics";

export async function POST(request: NextRequest) {
  if (!(await getAuthorizedEmail(request.headers.get("cookie")))) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  let body: {
    documentUrl?: string;
    documentUrls?: unknown;
    reponseBrute?: string;
    propositionInitiale?: unknown;
    modele?: string;
    versionPrompt?: string;
    analyseLe?: string;
  };
  try {
    body = await request.json();
  } catch (error) {
    logOrdonnanceScanFailure("database", error, { operation: "read_request" });
    return NextResponse.json(
      { error: ordonnanceScanUserMessage("database"), stage: "database" },
      { status: 400 },
    );
  }
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
  let extraction;
  try {
    extraction = await prisma.extractionOrdonnance.create({
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
  } catch (error) {
    logOrdonnanceScanFailure("database", error);
    return NextResponse.json(
      { error: ordonnanceScanUserMessage("database"), stage: "database" },
      { status: 500 },
    );
  }

  return NextResponse.json({ id: extraction.id, statut: extraction.statut }, { status: 201 });
}

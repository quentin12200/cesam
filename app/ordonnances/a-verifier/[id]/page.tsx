export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import BackButton from "@/app/components/BackButton";
import { parseDocumentUrls, type PropositionOrdonnance } from "@/lib/ordonnance-types";
import { getCategorieMedicament } from "@/lib/medicament-categories";
import { reevaluerCorrespondancesOrdonnance } from "@/lib/ordonnance-extraction";
import { chargerCandidatsOrdonnance } from "@/lib/ordonnance-medication-candidates";
import VerificationOrdonnanceClient from "./VerificationOrdonnanceClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VerificationOrdonnancePage({ params }: PageProps) {
  const { id } = await params;
  const [extraction, candidatsPharmacie] = await Promise.all([
    prisma.extractionOrdonnance.findUnique({ where: { id } }),
    chargerCandidatsOrdonnance((args) => prisma.medicament.findMany(args)),
  ]);
  if (!extraction) notFound();
  if (extraction.statut === "VALIDEE" && extraction.ordonnanceId) {
    redirect(`/ordonnances/${extraction.ordonnanceId}`);
  }

  let propositionInitiale: PropositionOrdonnance;
  try {
    propositionInitiale = JSON.parse(extraction.propositionInitiale) as PropositionOrdonnance;
  } catch {
    propositionInitiale = {};
  }
  propositionInitiale = reevaluerCorrespondancesOrdonnance(propositionInitiale, candidatsPharmacie);

  return (
    <div className="p-4 pb-24 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Informations détectées — à vérifier</h1>
          <p className="text-xs text-gray-500">L’ordonnance ne sera utilisable qu’après votre validation.</p>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
          À vérifier
        </span>
      </div>

      <VerificationOrdonnanceClient
        extraction={{
          id: extraction.id,
          documentUrls: parseDocumentUrls(extraction.documentUrls, extraction.documentUrl),
          modele: extraction.modele,
          versionPrompt: extraction.versionPrompt,
          analyseLe: extraction.analyseLe.toISOString(),
        }}
        propositionInitiale={propositionInitiale}
        medicamentsPharmacie={candidatsPharmacie.map((medicament) => ({
          ...medicament,
          categorieLabel: getCategorieMedicament(medicament.categorie).label,
          score: 0,
          concordances: [],
          divergences: [],
        }))}
      />
    </div>
  );
}

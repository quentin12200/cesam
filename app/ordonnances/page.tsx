export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { FileText } from "lucide-react";
import OrdonnancesClient, { type ExtractionAVerifierItem, type OrdonnanceItem } from "./OrdonnancesClient";
import { ordonnanceSourceKey, regrouperOrdonnancesPourListe } from "@/lib/ordonnance-list";

import BackButton from "@/app/components/BackButton";
async function getOrdonnances(): Promise<OrdonnanceItem[]> {
  const rows = await prisma.ordonnance.findMany({
    orderBy: { date: "desc" },
    take: 200,
    include: {
      extraction: { select: { id: true } },
      medicaments: { select: { nomExtrait: true }, orderBy: { createdAt: "asc" } },
    },
  });
  return regrouperOrdonnancesPourListe(rows.map((o) => ({
    id: o.id,
    date: o.date.toISOString(),
    numero: o.numero,
    veterinaireNom: o.veterinaireNom,
    medicamentNom: o.medicamentNom,
    dose: o.dose,
    uniteDosage: o.uniteDosage,
    referenceValue: o.referenceValue,
    referenceUnit: o.referenceUnit,
    referenceType: o.referenceType,
    voie: o.voie,
    dureeJours: o.dureeJours,
    motif: o.motif,
    animaux: o.animaux,
    statut: o.statut,
    notes: o.notes,
    photoUrl: o.photoUrl,
    extractionId: o.extraction?.id,
    sourceKey: ordonnanceSourceKey({
      id: o.id,
      extractionId: o.extraction?.id,
      photoUrl: o.photoUrl,
      photoUrls: o.photoUrls,
    }),
    medicaments: o.medicaments,
  })));
}

async function getExtractionsAVerifier(): Promise<ExtractionAVerifierItem[]> {
  const rows = await prisma.extractionOrdonnance.findMany({
    where: { statut: "A_VERIFIER" },
    orderBy: { analyseLe: "desc" },
    take: 50,
  });
  return rows.map((row) => {
    let proposition: {
      medicamentNom?: string | null;
      medicaments?: Array<{ medicamentNom?: string | null }>;
      ordonnanceNumero?: string | null;
    } = {};
    try {
      proposition = JSON.parse(row.propositionInitiale);
    } catch {}
    return {
      id: row.id,
      analyseLe: row.analyseLe.toISOString(),
      medicamentNom: proposition.medicaments && proposition.medicaments.length > 1
        ? `${proposition.medicaments.length} médicaments détectés`
        : proposition.medicaments?.[0]?.medicamentNom ?? proposition.medicamentNom ?? null,
      ordonnanceNumero: proposition.ordonnanceNumero ?? null,
    };
  });
}

export default async function OrdonnancesPage() {
  const [ordonnances, extractionsAVerifier] = await Promise.all([
    getOrdonnances(),
    getExtractionsAVerifier(),
  ]);

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3 mt-2">
        <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
        <div className="flex items-center gap-2 flex-1">
          <FileText size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Ordonnances</h2>
        </div>
        <span className="text-sm text-gray-400">{ordonnances.filter((o) => o.statut !== "ARCHIVE").length} active{ordonnances.filter((o) => o.statut !== "ARCHIVE").length > 1 ? "s" : ""}</span>
      </div>

      <OrdonnancesClient ordonnances={ordonnances} extractionsAVerifier={extractionsAVerifier} />
    </div>
  );
}

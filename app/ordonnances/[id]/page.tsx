export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ordonnanceSourceKey } from "@/lib/ordonnance-list";
import { ordonnanceMedicationSources } from "@/lib/ordonnance-detail";
import OrdonnanceDetailClient from "./OrdonnanceDetailClient";

import BackButton from "@/app/components/BackButton";
interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ source?: string }>;
}

const ordonnanceInclude = {
  extraction: { select: { id: true } },
  medicament: { select: { nom: true, categorie: true } },
  medicaments: {
    include: { medicament: { select: { nom: true, categorie: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  traitements: {
    include: { animal: { select: { nutrav: true, nobovi: true } } },
    orderBy: { dateDebut: "desc" as const },
  },
  vaccinations: {
    include: { animal: { select: { nutrav: true, nobovi: true } } },
    orderBy: { date: "desc" as const },
  },
} as const;

function documentUrls(photoUrls: string | null, photoUrl: string | null): string[] {
  if (photoUrls) {
    try {
      const parsed = JSON.parse(photoUrls);
      if (Array.isArray(parsed)) {
        const urls = parsed.filter((url): url is string => typeof url === "string" && url.length > 0);
        if (urls.length > 0) return urls;
      }
    } catch {}
  }
  return photoUrl ? [photoUrl] : [];
}

export default async function OrdonnanceDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { source } = await searchParams;

  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id },
    include: ordonnanceInclude,
  });

  if (!ordonnance) notFound();

  const sourceAttendue = ordonnanceSourceKey({
    id: ordonnance.id,
    extractionId: ordonnance.extraction?.id,
    photoUrl: ordonnance.photoUrl,
    photoUrls: ordonnance.photoUrls,
  });
  const sourceValide = source === sourceAttendue;
  const ordonnancesDuDocument = sourceValide && ordonnance.photoUrls
    ? await prisma.ordonnance.findMany({
      where: { photoUrls: ordonnance.photoUrls },
      include: ordonnanceInclude,
      orderBy: { createdAt: "asc" },
    })
    : sourceValide && ordonnance.photoUrl
      ? await prisma.ordonnance.findMany({
        where: { photoUrl: ordonnance.photoUrl },
        include: ordonnanceInclude,
        orderBy: { createdAt: "asc" },
      })
      : [ordonnance];
  const ordonnanceComplete = [...ordonnancesDuDocument].sort(
    (left, right) => right.medicaments.length - left.medicaments.length,
  )[0] ?? ordonnance;
  const medicaments = ordonnanceMedicationSources(ordonnancesDuDocument);
  const traitements = Array.from(new Map(
    ordonnancesDuDocument.flatMap((item) => item.traitements).map((item) => [item.id, item]),
  ).values());
  const vaccinations = Array.from(new Map(
    ordonnancesDuDocument.flatMap((item) => item.vaccinations).map((item) => [item.id, item]),
  ).values());

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-3 mt-2">
        <BackButton className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50" iconSize={18} />
        <div className="flex items-center gap-2 flex-1">
          <FileText size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Fiche ordonnance</h2>
        </div>
      </div>

      <OrdonnanceDetailClient
        ordonnance={{
          id: ordonnanceComplete.id,
          date: ordonnanceComplete.date.toISOString(),
          numero: ordonnanceComplete.numero,
          veterinaireNom: ordonnanceComplete.veterinaireNom,
          medicamentNom: ordonnanceComplete.medicamentNom,
          dose: ordonnanceComplete.dose,
          uniteDosage: ordonnanceComplete.uniteDosage,
          referenceValue: ordonnanceComplete.referenceValue,
          referenceUnit: ordonnanceComplete.referenceUnit,
          referenceType: ordonnanceComplete.referenceType,
          administrationCount: ordonnanceComplete.administrationCount,
          administrationIntervalHours: ordonnanceComplete.administrationIntervalHours,
          repeatCondition: ordonnanceComplete.repeatCondition,
          administrationInstructions: ordonnanceComplete.administrationInstructions,
          delaiAttenteViandeJ: ordonnanceComplete.delaiAttenteViandeJ,
          delaiAttenteAbatsJ: ordonnanceComplete.delaiAttenteAbatsJ,
          delaiAttenteLaitJ: ordonnanceComplete.delaiAttenteLaitJ,
          voie: ordonnanceComplete.voie,
          dureeJours: ordonnanceComplete.dureeJours,
          motif: ordonnanceComplete.motif,
          animaux: ordonnanceComplete.animaux,
          statut: ordonnanceComplete.statut,
          notes: ordonnanceComplete.notes,
          photoUrl: ordonnanceComplete.photoUrl,
          photoUrls: documentUrls(ordonnanceComplete.photoUrls, ordonnanceComplete.photoUrl),
        }}
        medicaments={medicaments.map((source) => {
          if (source.kind === "relation") {
            const item = source.medication;
            return {
              id: item.id,
              storageType: "relation" as const,
              ordonnanceId: source.ordonnanceId,
              nomExtrait: item.nomExtrait,
              nomPharmacie: item.medicament.nom,
              categorie: item.medicament.categorie,
              substanceActive: item.substanceActive,
              concentration: item.concentration,
              formePharmaceutique: item.formePharmaceutique,
              conditionnement: item.conditionnement,
              posologieExtraite: item.posologieExtraite,
              dose: item.dose,
              uniteDosage: item.uniteDosage,
              referenceValue: item.referenceValue,
              referenceUnit: item.referenceUnit,
              normalizedDoseValue: item.normalizedDoseValue,
              normalizedDoseUnit: item.normalizedDoseUnit,
              voieExtraite: item.voieExtraite,
              dureeExtraite: item.dureeExtraite,
              administrationCount: item.administrationCount,
              administrationIntervalHours: item.administrationIntervalHours,
              repeatCondition: item.repeatCondition,
              administrationInstructions: item.administrationInstructions,
              delaiAttenteViande: item.delaiAttenteViande,
              delaiAttenteAbats: item.delaiAttenteAbats,
              delaiAttenteLait: item.delaiAttenteLait,
              precautions: item.precautions,
              statutCorrespondance: item.statutCorrespondance,
            };
          }

          const item = source.row;
          const posologie = item.dose != null
            ? `${item.dose} ${item.uniteDosage ?? ""}${item.referenceValue != null
              ? ` / ${item.referenceValue} ${item.referenceUnit ?? "kg"}`
              : ""}`.trim()
            : null;
          return {
            id: item.id,
            storageType: "legacy" as const,
            ordonnanceId: item.id,
            nomExtrait: item.medicamentNom,
            nomPharmacie: item.medicament?.nom ?? item.medicamentNom,
            categorie: item.medicament?.categorie ?? item.categorieMedicament ?? "",
            substanceActive: item.substanceActive,
            concentration: item.concentration,
            formePharmaceutique: item.formePharmaceutique,
            conditionnement: item.conditionnement,
            posologieExtraite: posologie,
            dose: item.dose,
            uniteDosage: item.uniteDosage,
            referenceValue: item.referenceValue,
            referenceUnit: item.referenceUnit,
            normalizedDoseValue: item.normalizedDoseValue,
            normalizedDoseUnit: item.normalizedDoseUnit,
            voieExtraite: item.voie,
            dureeExtraite: item.dureeJours,
            administrationCount: item.administrationCount,
            administrationIntervalHours: item.administrationIntervalHours,
            repeatCondition: item.repeatCondition,
            administrationInstructions: item.administrationInstructions,
            delaiAttenteViande: item.delaiAttenteViandeJ,
            delaiAttenteAbats: item.delaiAttenteAbatsJ,
            delaiAttenteLait: item.delaiAttenteLaitJ,
            precautions: item.precautions,
            statutCorrespondance: item.medicamentId ? "matched" : "legacy",
          };
        })}
        traitements={traitements.map((t) => ({
          id: t.id,
          medicamentNom: t.medicamentNom,
          dateDebut: t.dateDebut.toISOString(),
          animalNutrav: t.animal.nutrav,
          animalNom: t.animal.nobovi,
        }))}
        vaccinations={vaccinations.map((v) => ({
          id: v.id,
          vaccin: v.vaccin,
          date: v.date.toISOString(),
          animalNutrav: v.animal.nutrav,
          animalNom: v.animal.nobovi,
        }))}
      />
    </div>
  );
}

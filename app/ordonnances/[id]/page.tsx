export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import OrdonnanceDetailClient from "./OrdonnanceDetailClient";

import BackButton from "@/app/components/BackButton";
interface PageProps {
  params: Promise<{ id: string }>;
}

const ordonnanceInclude = {
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

export default async function OrdonnanceDetailPage({ params }: PageProps) {
  const { id } = await params;

  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id },
    include: ordonnanceInclude,
  });

  if (!ordonnance) notFound();

  const ordonnancesDuDocument = ordonnance.photoUrls
    ? await prisma.ordonnance.findMany({ where: { photoUrls: ordonnance.photoUrls }, include: ordonnanceInclude })
    : ordonnance.photoUrl
      ? await prisma.ordonnance.findMany({ where: { photoUrl: ordonnance.photoUrl }, include: ordonnanceInclude })
      : [ordonnance];
  const ordonnanceComplete = [...ordonnancesDuDocument].sort(
    (left, right) => right.medicaments.length - left.medicaments.length,
  )[0] ?? ordonnance;
  const medicaments = ordonnanceComplete.medicaments.length > 1
    ? ordonnanceComplete.medicaments
    : ordonnancesDuDocument.flatMap((item) => item.medicaments);
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
          id: ordonnance.id,
          date: ordonnance.date.toISOString(),
          numero: ordonnance.numero,
          veterinaireNom: ordonnance.veterinaireNom,
          medicamentNom: ordonnance.medicamentNom,
          dose: ordonnance.dose,
          uniteDosage: ordonnance.uniteDosage,
          referenceValue: ordonnance.referenceValue,
          referenceUnit: ordonnance.referenceUnit,
          referenceType: ordonnance.referenceType,
          administrationCount: ordonnance.administrationCount,
          administrationIntervalHours: ordonnance.administrationIntervalHours,
          repeatCondition: ordonnance.repeatCondition,
          administrationInstructions: ordonnance.administrationInstructions,
          delaiAttenteViandeJ: ordonnance.delaiAttenteViandeJ,
          delaiAttenteAbatsJ: ordonnance.delaiAttenteAbatsJ,
          delaiAttenteLaitJ: ordonnance.delaiAttenteLaitJ,
          voie: ordonnance.voie,
          dureeJours: ordonnance.dureeJours,
          motif: ordonnance.motif,
          animaux: ordonnance.animaux,
          statut: ordonnance.statut,
          notes: ordonnance.notes,
          photoUrl: ordonnance.photoUrl,
          photoUrls: documentUrls(ordonnance.photoUrls, ordonnance.photoUrl),
        }}
        medicaments={medicaments.map((item) => ({
          id: item.id,
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
        }))}
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

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import OrdonnanceDetailClient from "./OrdonnanceDetailClient";

import BackButton from "@/app/components/BackButton";
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrdonnanceDetailPage({ params }: PageProps) {
  const { id } = await params;

  const ordonnance = await prisma.ordonnance.findUnique({
    where: { id },
    include: {
      medicaments: {
        include: { medicament: { select: { nom: true, categorie: true } } },
        orderBy: { createdAt: "asc" },
      },
      traitements: {
        include: { animal: { select: { nutrav: true, nobovi: true } } },
        orderBy: { dateDebut: "desc" },
      },
      vaccinations: {
        include: { animal: { select: { nutrav: true, nobovi: true } } },
        orderBy: { date: "desc" },
      },
    },
  });

  if (!ordonnance) notFound();

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
        }}
        medicaments={ordonnance.medicaments.map((item) => ({
          id: item.id,
          nomExtrait: item.nomExtrait,
          nomPharmacie: item.medicament.nom,
          categorie: item.medicament.categorie,
          posologieExtraite: item.posologieExtraite,
          voieExtraite: item.voieExtraite,
          dureeExtraite: item.dureeExtraite,
          delaiAttenteViande: item.delaiAttenteViande,
          delaiAttenteLait: item.delaiAttenteLait,
          statutCorrespondance: item.statutCorrespondance,
        }))}
        traitements={ordonnance.traitements.map((t) => ({
          id: t.id,
          medicamentNom: t.medicamentNom,
          dateDebut: t.dateDebut.toISOString(),
          animalNutrav: t.animal.nutrav,
          animalNom: t.animal.nobovi,
        }))}
        vaccinations={ordonnance.vaccinations.map((v) => ({
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

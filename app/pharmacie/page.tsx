export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Pill, Printer } from "lucide-react";
import PharmacieClient, { type MedicamentItem } from "./PharmacieClient";
import { type OrdonnanceItem } from "@/app/ordonnances/OrdonnancesClient";

async function getData() {
  const [medicaments, ordonnancesRaw] = await Promise.all([
    prisma.medicament.findMany({
      orderBy: { nom: "asc" },
      select: {
        id: true, nom: true, dci: true, categorie: true, voie: true,
        dosagePourKg: true, uniteDosage: true, delaiAttenteViandeJ: true, delaiAttenteLaitJ: true,
        prescriptionRequise: true, actif: true, favori: true, actions: true,
        stockActuel: true, stockUnite: true, stockSeuilAlert: true,
        preconisations: {
          where: { statut: { not: "REJETE" } },
          orderBy: [{ statut: "asc" }, { createdAt: "asc" }],
          take: 3,
          select: {
            id: true, indicationMotif: true, categorieAnimaux: true,
            dose: true, unite: true, doseBase: true, voie: true, statut: true,
          },
        },
      },
    }),
    prisma.ordonnance.findMany({
      orderBy: { date: "desc" },
      take: 200,
    }),
  ]);

  const medicamentItems: MedicamentItem[] = medicaments.map((m) => ({
    id: m.id,
    nom: m.nom,
    dci: m.dci,
    categorie: m.categorie,
    voie: m.voie,
    dosagePourKg: m.dosagePourKg,
    uniteDosage: m.uniteDosage,
    delaiAttenteViandeJ: m.delaiAttenteViandeJ,
    delaiAttenteLaitJ: m.delaiAttenteLaitJ,
    prescriptionRequise: m.prescriptionRequise,
    actif: m.actif,
    favori: m.favori,
    actions: m.actions,
    stockActuel: m.stockActuel,
    stockUnite: m.stockUnite,
    stockSeuilAlert: m.stockSeuilAlert,
    preconisations: m.preconisations,
  }));

  const ordonnanceItems: OrdonnanceItem[] = ordonnancesRaw.map((o) => ({
    id: o.id,
    date: o.date.toISOString(),
    numero: o.numero,
    veterinaireNom: o.veterinaireNom,
    medicamentNom: o.medicamentNom,
    dose: o.dose,
    uniteDosage: o.uniteDosage,
    voie: o.voie,
    dureeJours: o.dureeJours,
    motif: o.motif,
    animaux: o.animaux,
    statut: o.statut,
    notes: o.notes,
    photoUrl: o.photoUrl,
  }));

  return { medicamentItems, ordonnanceItems };
}

export default async function PharmaciePage() {
  const { medicamentItems, ordonnanceItems } = await getData();

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/sanitaire" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex items-center gap-2 flex-1">
          <Pill size={20} className="text-blue-600" />
          <h2 className="text-xl font-bold text-gray-800">Pharmacie</h2>
        </div>
        <Link
          href="/pharmacie/impression"
          className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50"
          title="Imprimer les traitements en cours"
        >
          <Printer size={18} />
        </Link>
      </div>

      <PharmacieClient medicaments={medicamentItems} ordonnances={ordonnanceItems} />
    </div>
  );
}

export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Pill, Printer } from "lucide-react";
import { addDays, differenceInDays } from "date-fns";
import { getAttenteInfoForTraitement } from "@/lib/withdrawal";
import PharmacieClient, { type TraitementItem, type MedicamentItem } from "./PharmacieClient";

async function getData() {
  const now = new Date();

  const [traitements, medicaments] = await Promise.all([
    prisma.traitement.findMany({
      include: {
        animal: { select: { id: true, nutrav: true, nobovi: true } },
        medicament: { select: { id: true, nom: true, delaiAttenteViandeJ: true, delaiAttenteLaitJ: true } },
      },
      orderBy: { dateDebut: "desc" },
    }),
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
  ]);

  const traitementsItems: TraitementItem[] = traitements.map((t) => {
    const dateDebut = new Date(t.dateDebut);
    const dateFin = addDays(dateDebut, t.dureeJours);
    const attente = getAttenteInfoForTraitement(t, now);
    const delaiViande = t.delaiAttenteViandeJ ?? t.medicament?.delaiAttenteViandeJ ?? null;
    const dateFinAttente = attente.dateFinAttenteViande;
    const enCours = now < dateFin;
    const enAttente = attente.enAttente;
    const joursRestantsAttente = dateFinAttente ? differenceInDays(dateFinAttente, now) : null;

    return {
      id: t.id,
      animalId: t.animal.id,
      animalNutrav: t.animal.nutrav,
      animalNom: t.animal.nobovi,
      medicamentNom: t.medicamentNom,
      medicamentId: t.medicamentId,
      dateDebut: dateDebut.toISOString(),
      dateFin: dateFin.toISOString(),
      dureeJours: t.dureeJours,
      voie: t.voie,
      dose: t.dose,
      uniteDosage: t.uniteDosage,
      motif: t.motif,
      veterinaire: t.veterinaire,
      statut: t.statut,
      notes: t.notes,
      delaiAttenteViandeJ: delaiViande,
      dateFinAttente: dateFinAttente?.toISOString() ?? null,
      enCours,
      enAttente,
      joursRestantsAttente,
    };
  });

  // Last 3 traitements per medicamentId
  const recentByMed: Record<string, { date: string; animalNutrav: string; motif: string | null }[]> = {};
  for (const t of traitements) {
    if (!t.medicamentId) continue;
    if (!recentByMed[t.medicamentId]) recentByMed[t.medicamentId] = [];
    if (recentByMed[t.medicamentId].length < 3) {
      recentByMed[t.medicamentId].push({
        date: t.dateDebut.toISOString(),
        animalNutrav: t.animal.nutrav,
        motif: t.motif,
      });
    }
  }

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
    recentTraitements: recentByMed[m.id] ?? [],
  }));

  return { traitementsItems, medicamentItems };
}

export default async function PharmaciePage() {
  const { traitementsItems, medicamentItems } = await getData();

  return (
    <div className="p-4 space-y-4 max-w-2xl md:max-w-3xl lg:max-w-4xl mx-auto pb-24">
      <div className="flex items-center gap-3 mt-2">
        <Link href="/" className="p-2 bg-white rounded-lg shadow text-gray-500 hover:bg-gray-50">
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

      <PharmacieClient traitements={traitementsItems} medicaments={medicamentItems} />
    </div>
  );
}

export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeft, Pill, Printer } from "lucide-react";
import { addDays, differenceInDays } from "date-fns";
import PharmacieClient, { type TraitementItem, type MedicamentItem } from "./PharmacieClient";

async function getData() {
  const now = new Date();

  const [traitements, medicaments] = await Promise.all([
    prisma.traitement.findMany({
      include: {
        animal: { select: { id: true, nutrav: true, nobovi: true } },
        medicament: { select: { id: true, nom: true, delaiAttenteViandeJ: true } },
      },
      orderBy: { dateDebut: "desc" },
    }),
    prisma.medicament.findMany({ orderBy: { nom: "asc" } }),
  ]);

  const traitementsItems: TraitementItem[] = traitements.map((t) => {
    const dateDebut = new Date(t.dateDebut);
    const dateFin = addDays(dateDebut, t.dureeJours);
    const delaiViande = t.medicament?.delaiAttenteViandeJ ?? null;
    const dateFinAttente = delaiViande != null ? addDays(dateFin, delaiViande) : null;
    const enCours = now < dateFin;
    const enAttente = dateFinAttente != null ? now < dateFinAttente : false;
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

  const medicamentItems: MedicamentItem[] = medicaments.map((m) => ({
    id: m.id,
    nom: m.nom,
    dci: m.dci,
    categorie: m.categorie,
    voie: m.voie,
    dosagePourKg: m.dosagePourKg,
    uniteDosage: m.uniteDosage,
    delaiAttenteViandeJ: m.delaiAttenteViandeJ,
    prescriptionRequise: m.prescriptionRequise,
    actif: m.actif,
  }));

  return { traitementsItems, medicamentItems };
}

export default async function PharmaciePage() {
  const { traitementsItems, medicamentItems } = await getData();

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto pb-24">
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

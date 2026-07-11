import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

export interface CarnetSanitaireRow {
  id: string;
  date: Date;
  animalId: string;
  animalNutrav: string;
  animalNational: string;
  animalNom: string | null;
  ordonnanceNumero: string | null;
  prescripteur: string | null;
  produit: string;
  dose: string;
  voie: string | null;
  motif: string | null;
  dateRemiseLait: Date | null;
  dateRemiseViande: Date | null;
}

export async function getCarnetSanitaireRows(): Promise<CarnetSanitaireRow[]> {
  const [traitements, vaccinations] = await Promise.all([
    prisma.traitement.findMany({
      include: {
        animal: { select: { id: true, nutrav: true, nunati: true, nobovi: true, copaip: true } },
        medicament: { select: { delaiAttenteViandeJ: true, delaiAttenteLaitJ: true } },
      },
      orderBy: { dateDebut: "asc" },
    }),
    prisma.vaccination.findMany({
      include: { animal: { select: { id: true, nutrav: true, nunati: true, nobovi: true, copaip: true } } },
      orderBy: { date: "asc" },
    }),
  ]);

  const rows: CarnetSanitaireRow[] = [];

  for (const t of traitements) {
    const dateFinTraitement = addDays(t.dateDebut, t.dureeJours);
    const dateRemiseViande = t.medicament?.delaiAttenteViandeJ != null
      ? addDays(dateFinTraitement, t.medicament.delaiAttenteViandeJ + 1)
      : null;
    const dateRemiseLait = t.medicament?.delaiAttenteLaitJ != null
      ? addDays(dateFinTraitement, t.medicament.delaiAttenteLaitJ)
      : null;
    rows.push({
      id: t.id,
      date: t.dateDebut,
      animalId: t.animal.id,
      animalNutrav: t.animal.nutrav,
      animalNational: t.animal.nunati,
      animalNom: t.animal.nobovi,
      ordonnanceNumero: t.ordonnanceNumero,
      prescripteur: t.veterinaire,
      produit: t.medicamentNom,
      dose: t.dose != null ? `${t.dose} ${t.uniteDosage ?? ""}`.trim() : "",
      voie: t.voie,
      motif: t.motif,
      dateRemiseLait,
      dateRemiseViande,
    });
  }

  for (const v of vaccinations) {
    rows.push({
      id: v.id,
      date: v.date,
      animalId: v.animal.id,
      animalNutrav: v.animal.nutrav,
      animalNational: v.animal.nunati,
      animalNom: v.animal.nobovi,
      ordonnanceNumero: null,
      prescripteur: null,
      produit: v.vaccin,
      dose: v.dose != null ? `${v.dose} ml` : "",
      voie: v.voie,
      motif: "VACCINATION",
      dateRemiseLait: null,
      dateRemiseViande: null,
    });
  }

  rows.sort((a, b) => a.date.getTime() - b.date.getTime());
  return rows;
}

export function groupRowsByAnimal(rows: CarnetSanitaireRow[]): { animalNutrav: string; animalNom: string | null; rows: CarnetSanitaireRow[] }[] {
  const groups = new Map<string, { animalNutrav: string; animalNom: string | null; rows: CarnetSanitaireRow[] }>();
  for (const row of rows) {
    if (!groups.has(row.animalId)) {
      groups.set(row.animalId, { animalNutrav: row.animalNutrav, animalNom: row.animalNom, rows: [] });
    }
    groups.get(row.animalId)!.rows.push(row);
  }
  return Array.from(groups.values()).sort((a, b) => a.animalNutrav.localeCompare(b.animalNutrav, undefined, { numeric: true }));
}

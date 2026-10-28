import { prisma } from "@/lib/prisma";
import { getAttenteInfoForTraitement } from "@/lib/withdrawal";
import { unifierActesDuCarnet, type ActeSanitaireReel } from "@/lib/carnet-actes";

/** Recherche du carnet : lecture seule des administrations, même sans protocole. */
export async function getActesSanitairesReels(): Promise<ActeSanitaireReel[]> {
  const [vaccinations, traitements] = await Promise.all([
    prisma.vaccination.findMany({
      where: { statut: "FAIT" },
      select: {
        id: true, date: true, statut: true, vaccin: true, medicamentId: true,
        animal: { select: { id: true, nutrav: true, nobovi: true } },
        medicament: { select: { nom: true } },
        protocole: { select: { label: true } },
        etapeProtocole: { select: { label: true } },
      },
    }),
    prisma.traitement.findMany({
      select: {
        id: true, dateDebut: true, medicamentNom: true, medicamentId: true, executant: true,
        animal: { select: { id: true, nutrav: true, nobovi: true } },
        evenement: { select: { constatePar: true } },
        protocoleVaccin: { select: { label: true } },
        etapeProtocoleVaccin: { select: { label: true } },
      },
    }),
  ]);
  return unifierActesDuCarnet(
    vaccinations.map((v) => ({ id: v.id, animal: { id: v.animal.id, nutrav: v.animal.nutrav, nom: v.animal.nobovi },
      date: v.date, statut: v.statut, vaccin: v.vaccin, medicamentId: v.medicamentId,
      medicamentNom: v.medicament?.nom ?? null, protocoleNom: v.protocole?.label ?? null,
      etapeNom: v.etapeProtocole?.label ?? null })),
    traitements.map((t) => ({ id: t.id, animal: { id: t.animal.id, nutrav: t.animal.nutrav, nom: t.animal.nobovi },
      date: t.dateDebut, medicamentNom: t.medicamentNom, medicamentId: t.medicamentId,
      executant: t.executant ?? t.evenement?.constatePar ?? null,
      protocoleNom: t.protocoleVaccin?.label ?? null, etapeNom: t.etapeProtocoleVaccin?.label ?? null })),
  );
}

export interface CarnetSanitaireRow {
  id: string;
  sourceType: "TRAITEMENT" | "VACCINATION";
  executant: string | null;
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
    const attente = getAttenteInfoForTraitement(t);
    const dateRemiseViande = attente.dateFinAttenteViande;
    const dateRemiseLait = attente.dateFinAttenteLait;
    rows.push({
      id: t.id,
      sourceType: "TRAITEMENT",
      executant: t.executant,
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
      sourceType: "VACCINATION",
      executant: null,
      date: v.date,
      animalId: v.animal.id,
      animalNutrav: v.animal.nutrav,
      animalNational: v.animal.nunati,
      animalNom: v.animal.nobovi,
      ordonnanceNumero: v.ordonnanceNumero,
      prescripteur: v.veterinaire,
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

export interface EvenementCarnetRow {
  id: string;
  date: Date;
  animalId: string;
  animalNutrav: string;
  animalNom: string | null;
  categorie: string | null;
  type: string;
  produits: string[];
  symptomes: string[];
  temperature: number | null;
  moment: string | null;
  description: string | null;
  constatePar: string | null;
  resolu: boolean;
}

export async function getEvenementsCarnetRows(): Promise<EvenementCarnetRow[]> {
  const evenements = await prisma.evenementSanitaire.findMany({
    include: {
      animal: { select: { id: true, nutrav: true, nobovi: true } },
      symptomes: { select: { libelle: true } },
      traitements: { select: { medicamentNom: true } },
    },
    orderBy: { date: "asc" },
  });

  return evenements.map((e) => ({
    id: e.id,
    date: e.date,
    animalId: e.animal.id,
    animalNutrav: e.animal.nutrav,
    animalNom: e.animal.nobovi,
    categorie: e.categorie,
    type: e.type,
    produits: [...new Set(e.traitements.map((t) => t.medicamentNom).filter(Boolean))],
    symptomes: e.symptomes.map((s) => s.libelle),
    temperature: e.temperature,
    moment: e.moment,
    description: e.description,
    constatePar: e.constatePar,
    resolu: e.resolu,
  }));
}

export function groupEvenementsByAnimal(rows: EvenementCarnetRow[]): { animalNutrav: string; animalNom: string | null; rows: EvenementCarnetRow[] }[] {
  const groups = new Map<string, { animalNutrav: string; animalNom: string | null; rows: EvenementCarnetRow[] }>();
  for (const row of rows) {
    if (!groups.has(row.animalId)) {
      groups.set(row.animalId, { animalNutrav: row.animalNutrav, animalNom: row.animalNom, rows: [] });
    }
    groups.get(row.animalId)!.rows.push(row);
  }
  return Array.from(groups.values()).sort((a, b) => a.animalNutrav.localeCompare(b.animalNutrav, undefined, { numeric: true }));
}

import "server-only";

import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCategorie } from "@/lib/utils";
import {
  calculerActionVaccinale,
  proposerConditionnements,
  reliquatFlacon,
  type StatutPreparationVaccin,
} from "@/lib/vaccine-planner";

export interface LignePreparationVaccin {
  animalId: string;
  nutrav: string;
  nom: string | null;
  injection: string;
  repere: string;
  dateMin: Date;
  dateMax: Date;
  groupe: string;
  dose: string;
  statut: StatutPreparationVaccin;
}

export interface GroupePreparationVaccin {
  protocoleId: string;
  vaccin: string;
  medicamentId: string | null;
  lignes: LignePreparationVaccin[];
  aFaire: number;
  bientot: number;
  termines: number;
  dosesNecessaires: number;
  flacons: {
    reliquatUtilise: number;
    nombre: number;
    dosesParConditionnement: number | null;
    totalDisponible: number;
  };
}

function categoriesCibles(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function correspondCategorie(cibles: string[], categorie: string): boolean {
  if (cibles.length === 0) return true;
  return cibles.some((cible) => {
    if (cible === "VEAU") return categorie === "VEAU_M" || categorie === "VELLE";
    if (cible === "GENISSE") return categorie.includes("GENISSE");
    return cible === categorie;
  });
}

function libelleInjection(label: string, ordre: number, totalInitial: number, cycle: string): string {
  if (cycle === "ENTRETIEN") return /rappel/i.test(label) ? label : "Entretien";
  if (totalInitial > 1) return /primo|rappel/i.test(label) ? label : `Primo ${ordre + 1}/${totalInitial}`;
  return label || "Injection";
}

export async function getPreparationsVaccinales(date = new Date()): Promise<GroupePreparationVaccin[]> {
  const [protocoles, animaux] = await Promise.all([
    prisma.protocoleVaccin.findMany({
      where: { actif: true },
      orderBy: { ordre: "asc" },
      include: {
        etapes: {
          orderBy: { ordre: "asc" },
          include: {
            medicaments: {
              where: { alternative: false },
              include: {
                medicament: {
                  include: {
                    preconisations: true,
                    conditionnements: { where: { actif: true } },
                    flaconsOuverts: { where: { statut: "OUVERT" }, include: { utilisations: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.animal.findMany({
      where: { statut: "ACTIF" },
      select: {
        id: true,
        nutrav: true,
        nobovi: true,
        danais: true,
        sexbov: true,
        estGenisse: true,
        categorie: true,
        groupe: { select: { nom: true } },
        localisation: { select: { nom: true } },
        _count: { select: { velagesVache: true } },
        saillies: {
          where: { gestation: { is: { dateVelagePrevue: { not: null }, etat: { in: ["VERT", "ROSE"] } } } },
          orderBy: { date: "desc" },
          take: 1,
          select: { gestation: { select: { id: true, dateVelagePrevue: true } } },
        },
        vaccinations: { select: { date: true, protocoleId: true, etapeProtocoleId: true, gestationId: true } },
      },
    }),
  ]);

  return protocoles.map((protocole) => {
    const cibles = categoriesCibles(protocole.categoriesJson);
    const totalInitial = protocole.etapes.filter((etape) => etape.cycle !== "ENTRETIEN").length;
    let termines = 0;
    const lignes: LignePreparationVaccin[] = [];
    let medicamentReference = protocole.etapes.flatMap((etape) => etape.medicaments)[0]?.medicament ?? null;

    for (const animal of animaux) {
      const categorie = getCategorie(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie);
      const gestation = animal.saillies[0]?.gestation ?? null;
      if (!correspondCategorie(cibles, categorie)) continue;
      if (protocole.sexeCible && protocole.sexeCible !== animal.sexbov) continue;
      if (protocole.gestante === true && !gestation) continue;
      if (protocole.gestante === false && gestation) continue;
      if (protocole.rangVelageMin != null && animal._count.velagesVache < protocole.rangVelageMin) continue;
      if (protocole.rangVelageMax != null && animal._count.velagesVache > protocole.rangVelageMax) continue;
      if (protocole.lotCible && animal.groupe?.nom !== protocole.lotCible) continue;

      const protocoleLieAuVelage = protocole.etapes.some((etape) => etape.reference === "VELAGE");
      const vaccinations = animal.vaccinations.filter((vaccination) =>
        vaccination.protocoleId === protocole.id
        && (!protocoleLieAuVelage || vaccination.gestationId === gestation?.id)
      );
      const action = calculerActionVaccinale({
        date,
        dateNaissance: animal.danais,
        dateVelagePrevue: gestation?.dateVelagePrevue,
        ageMinJours: protocole.ageMinJours,
        ageMaxJours: protocole.ageMaxJours,
        bientotJours: protocole.urgenceJours ?? 30,
        etapes: protocole.etapes,
        vaccinations,
      });
      if (action.statut === "TERMINE") {
        termines += 1;
        continue;
      }
      if (!action.etape || !action.dateMin || !action.dateMax) continue;
      const liaison = action.etape
        ? protocole.etapes.find((etape) => etape.id === action.etape!.id)?.medicaments[0]
        : null;
      const medicament = liaison?.medicament ?? null;
      if (medicament) medicamentReference = medicament;
      const preconisationLiee = liaison?.preconisationId
        ? medicament?.preconisations.find((item) => item.id === liaison.preconisationId)
        : null;
      const preconisationsValides = medicament?.preconisations.filter((item) => item.statut === "VALIDE" && item.dose != null) ?? [];
      const preconisation = preconisationLiee ?? (preconisationsValides.length === 1 ? preconisationsValides[0] : null);
      const voie = liaison?.voie || preconisation?.voie || medicament?.voie;
      const dose = preconisation?.dose == null
        ? (voie ? `Dose inconnue · ${voie}` : "—")
        : `${preconisation.dose} ${preconisation.unite || medicament?.uniteDosage || ""}${voie ? ` · ${voie}` : ""}`.trim();
      const joursAvantVelage = gestation?.dateVelagePrevue
        ? differenceInCalendarDays(gestation.dateVelagePrevue, date)
        : null;
      lignes.push({
        animalId: animal.id,
        nutrav: animal.nutrav,
        nom: animal.nobovi,
        injection: libelleInjection(action.etape.label, action.etape.ordre, totalInitial, action.etape.cycle),
        repere: action.raison === "VELAGE" && joursAvantVelage != null
          ? `Vêlage prévu dans ${joursAvantVelage} j`
          : `Âge ${differenceInCalendarDays(date, animal.danais)} j`,
        dateMin: action.dateMin,
        dateMax: action.dateMax,
        groupe: [animal.groupe?.nom, animal.localisation?.nom].filter(Boolean).join(" · ") || "—",
        dose,
        statut: action.statut,
      });
    }

    const imprimables = lignes.filter((ligne) => ["A_FAIRE", "A_PREVOIR", "EN_RETARD"].includes(ligne.statut));
    const reliquatsUtilisables = (medicamentReference?.flaconsOuverts ?? [])
      .filter((flacon) => flacon.dateOuverture <= date && flacon.dateLimiteUtilisation != null && flacon.dateLimiteUtilisation >= date)
      .map((flacon) => reliquatFlacon(flacon.dosesInitiales, flacon.utilisations));
    const flacons = proposerConditionnements({
      dosesNecessaires: imprimables.length,
      reliquatsUtilisables,
      conditionnements: (medicamentReference?.conditionnements ?? []).map((conditionnement) => conditionnement.doses),
    });
    lignes.sort((a, b) => a.dateMax.getTime() - b.dateMax.getTime() || a.nutrav.localeCompare(b.nutrav));
    return {
      protocoleId: protocole.id,
      vaccin: medicamentReference?.nom || protocole.label,
      medicamentId: medicamentReference?.id ?? null,
      lignes,
      aFaire: lignes.filter((ligne) => ligne.statut === "A_FAIRE" || ligne.statut === "EN_RETARD").length,
      bientot: lignes.filter((ligne) => ligne.statut === "A_PREVOIR").length,
      termines,
      dosesNecessaires: imprimables.length,
      flacons,
    };
  });
}

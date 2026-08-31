import "server-only";

import { differenceInCalendarDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getCategorie, getCategorieLabel } from "@/lib/utils";
import {
  calculerActionVaccinale,
  proposerConditionnements,
  reliquatFlacon,
  resoudreVoieVaccinale,
  type StatutProtocoleVaccinal,
} from "@/lib/vaccine-planner";
import { statutPlanningVaccin, type StatutPlanningVaccin } from "@/lib/vaccine-planning-status";

export interface LignePreparationVaccin {
  animalId: string;
  nutrav: string;
  nom: string | null;
  injection: string;
  repere: string;
  dateMin: Date;
  dateMax: Date;
  groupe: string;
  mere: string | null;
  dose: string;
  doseValeur: number | null;
  doseUnite: string | null;
  voie: string;
  medicamentId: string | null;
  etapeProtocoleId: string;
  gestationId: string | null;
  typeInjection: string | null;
  statut: StatutPlanningVaccin;
}

export interface GroupePreparationVaccin {
  protocoleId: string;
  vaccin: string;
  medicamentId: string | null;
  conditionnementRenseigne: boolean;
  dose: string;
  voie: string;
  lignes: LignePreparationVaccin[];
  aConfirmer: Array<{ animalId: string; nutrav: string; nom: string | null; groupe: string; categorie: string; ageJours: number }>;
  tropTot: number;
  bientot: number;
  aFaire: number;
  retardLeger: number;
  enRetard: number;
  termines: number;
  dosesNecessaires: number;
  flacons: {
    reliquatUtilise: number;
    nombre: number;
    dosesParConditionnement: number | null;
    totalDisponible: number;
    ouverts: number;
    dosesRestantes: number;
    prochaineLimite: Date | null;
    perte: number;
    conservationConnue: boolean;
    achats: Array<{ doses: number; nombre: number }>;
  };
  stockPharmacie: string;
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

function valeurUnique(valeurs: string[], inconnue: string): string {
  const uniques = [...new Set(valeurs.filter(Boolean))];
  if (uniques.length === 0) return inconnue;
  return uniques.length === 1 ? uniques[0] : "Selon l’étape";
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
        mereTravailManuel: true,
        mere: {
          select: {
            nutrav: true,
            nobovi: true,
            groupe: { select: { nom: true } },
            localisation: { select: { nom: true } },
          },
        },
        _count: { select: { velagesVache: true } },
        saillies: {
          where: { gestation: { is: { dateVelagePrevue: { not: null }, etat: { in: ["VERT", "ROSE"] } } } },
          orderBy: { date: "desc" },
          take: 1,
          select: { gestation: { select: { id: true, dateVelagePrevue: true } } },
        },
        vaccinations: { select: { date: true, protocoleId: true, etapeProtocoleId: true, gestationId: true } },
        statutsProtocolesVaccinaux: { select: { protocoleId: true, statut: true } },
      },
    }),
  ]);

  return protocoles.map((protocole) => {
    const cibles = categoriesCibles(protocole.categoriesJson);
    const etapesInitiales = protocole.etapes.filter((etape) => etape.cycle !== "ENTRETIEN");
    const totalInitial = etapesInitiales.length;
    let termines = 0;
    const lignes: LignePreparationVaccin[] = [];
    const aConfirmer: GroupePreparationVaccin["aConfirmer"] = [];
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
        bientotJours: 7,
        etapes: protocole.etapes,
        vaccinations,
        statutProtocole: (animal.statutsProtocolesVaccinaux.find((statut) => statut.protocoleId === protocole.id)?.statut ?? null) as StatutProtocoleVaccinal | null,
      });
      if (action.statut === "A_CONFIRMER") {
        aConfirmer.push({
          animalId: animal.id,
          nutrav: animal.nutrav,
          nom: animal.nobovi,
          groupe: animal.groupe?.nom || "Sans groupe",
          categorie: getCategorieLabel(animal.sexbov, animal.danais, animal.estGenisse, animal.categorie),
          ageJours: differenceInCalendarDays(date, animal.danais),
        });
        continue;
      }
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
      const preconisationsValides = medicament?.preconisations.filter((item) => item.statut === "VALIDE") ?? [];
      const preconisationsValidesDosees = preconisationsValides.filter((item) => item.dose != null);
      const preconisation = preconisationLiee ?? (preconisationsValidesDosees.length === 1 ? preconisationsValidesDosees[0] : null);
      const preconisationValideeAvecVoie = preconisationLiee?.statut === "VALIDE" && preconisationLiee.voie
        ? preconisationLiee
        : preconisationsValides.find((item) => item.voie) ?? null;
      const voie = resoudreVoieVaccinale({
        voiePreconisation: preconisationValideeAvecVoie?.voie,
        voieMedicament: medicament?.voie,
        voieLiaison: liaison?.voie,
      });
      const dose = preconisation?.dose == null
        ? "Dose inconnue"
        : `${preconisation.dose} ${preconisation.unite || medicament?.uniteDosage || ""}`.trim();
      const joursAvantVelage = gestation?.dateVelagePrevue
        ? differenceInCalendarDays(gestation.dateVelagePrevue, date)
        : null;
      const statut = action.statut === "EN_RETARD" && date <= action.dateMax
        ? "EN_RETARD"
        : statutPlanningVaccin(date, action.dateMin, action.dateMax);
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
        mere: differenceInCalendarDays(date, animal.danais) < 183
          ? [
              `Mère ${animal.mere?.nutrav || animal.mereTravailManuel || "—"}`,
              animal.mere ? [animal.mere.groupe?.nom, animal.mere.localisation?.nom].filter(Boolean).join(" · ") : null,
            ].filter(Boolean).join(" · ")
          : null,
        dose,
        doseValeur: preconisation?.dose ?? null,
        doseUnite: preconisation?.unite || medicament?.uniteDosage || null,
        voie,
        medicamentId: medicament?.id ?? null,
        etapeProtocoleId: action.etape.id,
        gestationId: protocoleLieAuVelage ? gestation?.id ?? null : null,
        typeInjection: action.etape.cycle === "ENTRETIEN" ? "ENTRETIEN" : etapesInitiales[0]?.id === action.etape.id ? "PRIMO_1" : "RAPPEL",
        statut,
      });
    }

    const preparables = lignes.filter((ligne) => ["A_FAIRE", "EN_RETARD_LEGER", "EN_RETARD"].includes(ligne.statut));
    const flaconsOuverts = medicamentReference?.flaconsOuverts ?? [];
    const reliquatsUtilisables = flaconsOuverts
      .filter((flacon) => flacon.dateOuverture <= date && flacon.dateLimiteUtilisation != null && flacon.dateLimiteUtilisation >= date)
      .map((flacon) => reliquatFlacon(flacon.dosesInitiales, flacon.utilisations));
    const flacons = proposerConditionnements({
      dosesNecessaires: preparables.length,
      reliquatsUtilisables,
      conditionnements: (medicamentReference?.conditionnements ?? []).map((conditionnement) => ({
        doses: conditionnement.doses,
        prixFlaconEur: conditionnement.prixFlaconEur,
        conservationOuvertureStatut: conditionnement.conservationOuvertureStatut ?? medicamentReference?.conservationOuvertureStatut,
      })),
    });
    lignes.sort((a, b) => a.dateMax.getTime() - b.dateMax.getTime() || a.nutrav.localeCompare(b.nutrav));
    return {
      protocoleId: protocole.id,
      vaccin: medicamentReference?.nom || protocole.label,
      medicamentId: medicamentReference?.id ?? null,
      conditionnementRenseigne: (medicamentReference?.conditionnements.length ?? 0) > 0,
      dose: valeurUnique(lignes.map((ligne) => ligne.dose), "Non renseignée"),
      voie: valeurUnique(lignes.map((ligne) => ligne.voie), "À renseigner"),
      lignes,
      aConfirmer,
      tropTot: lignes.filter((ligne) => ligne.statut === "TROP_TOT").length,
      bientot: lignes.filter((ligne) => ligne.statut === "A_PREVOIR").length,
      aFaire: lignes.filter((ligne) => ligne.statut === "A_FAIRE").length,
      retardLeger: lignes.filter((ligne) => ligne.statut === "EN_RETARD_LEGER").length,
      enRetard: lignes.filter((ligne) => ligne.statut === "EN_RETARD").length,
      termines,
      dosesNecessaires: preparables.length,
      flacons: {
        ...flacons,
        ouverts: flaconsOuverts.length,
        dosesRestantes: flaconsOuverts.reduce((total, flacon) => total + reliquatFlacon(flacon.dosesInitiales, flacon.utilisations), 0),
        prochaineLimite: flaconsOuverts.map((flacon) => flacon.dateLimiteUtilisation).filter((limite): limite is Date => limite != null).sort((a, b) => a.getTime() - b.getTime())[0] ?? null,
      },
      stockPharmacie: medicamentReference?.stockActuel == null ? "Non renseigné" : `${medicamentReference.stockActuel} ${medicamentReference.stockUnite || "dose(s)"}`,
    };
  });
}

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { choisirBrancheAgePrimo, lireConfigurationQuestionnaire } from "@/lib/vaccine-protocol-questionnaire";
import { resynchroniserStatutProtocole } from "@/lib/vaccine-statut-sync";

import { MHE_2026_NATIONAUX, MHE_2026_NUTRAV, chiffres, estMedicamentHepizovac, dateHistorique, planifierMhe2026 } from "@/lib/mhe-2026-plan";
import type { RapportMhe2026 } from "@/lib/mhe-2026-plan";
export type { RapportMhe2026 } from "@/lib/mhe-2026-plan";
type Db = Pick<Prisma.TransactionClient, "medicament" | "protocoleVaccin" | "animal" | "vaccination" | "traitement" | "preconisation">;

async function preparer(db: Db) {
  const medicaments = (await db.medicament.findMany({ where: { actif: true, categorie: "VACCIN" }, select: { id: true, nom: true } })).filter((item) => estMedicamentHepizovac(item.nom));
  if (medicaments.length !== 1) throw new Error(medicaments.length ? "Plusieurs médicaments HEPIZOVAC actifs : synchronisation refusée." : "Aucun médicament HEPIZOVAC actif en catégorie VACCIN.");
  const medicament = medicaments[0];
  const candidats = await db.protocoleVaccin.findMany({ where: { actif: true, configurationQuestionnaireJson: { not: null } }, select: { id: true, configurationQuestionnaireJson: true, etapes: { select: { id: true, medicaments: { select: { medicamentId: true, preconisationId: true } } } } } });
  const compatibles = candidats.map((protocole) => ({ protocole, config: lireConfigurationQuestionnaire(protocole.configurationQuestionnaireJson) }))
    .filter(({ config }) => config?.medicamentId === medicament.id && config.demarrage.type === "PRIMO_RAPPEL");
  if (compatibles.length !== 1) throw new Error(compatibles.length ? "Plusieurs protocoles questionnaire MHE actifs : synchronisation refusée." : "Aucun protocole questionnaire MHE actif avec Primo/Rappel.");
  const { protocole, config } = compatibles[0];
  if (!config || config.demarrage.type !== "PRIMO_RAPPEL") throw new Error("Configuration MHE invalide.");
  const etapes = { primo: config.demarrage.etapePrimoId, rappel: config.demarrage.etapeRappelId };
  if (etapes.primo === etapes.rappel || ![etapes.primo, etapes.rappel].every((id) => protocole.etapes.some((etape) => etape.id === id && etape.medicaments.some((liaison) => liaison.medicamentId === medicament.id)))) {
    throw new Error("Étapes Primo/Rappel MHE absentes ou non reliées à HEPIZOVAC.");
  }
  const animaux = await db.animal.findMany({ select: { id: true, nutrav: true, nunati: true, numeroNational: true, danais: true } });
  const ids = animaux.filter((animal) => MHE_2026_NUTRAV.some((numero) => numero === animal.nutrav) || MHE_2026_NATIONAUX.some((numero) => [animal.nunati, animal.numeroNational].some((value) => value && chiffres(value) === numero))).map((animal) => animal.id);
  const [vaccinations, traitements] = await Promise.all([
    db.vaccination.findMany({ where: { animalId: { in: ids }, date: { gte: new Date("2026-02-04T00:00:00Z"), lt: new Date("2026-04-16T00:00:00Z") } }, select: { id: true, animalId: true, date: true, vaccin: true, medicamentId: true, protocoleId: true, etapeProtocoleId: true, statut: true } }),
    db.traitement.findMany({ where: { animalId: { in: ids }, dateDebut: { gte: new Date("2026-02-04T00:00:00Z"), lt: new Date("2026-04-16T00:00:00Z") } }, select: { id: true, animalId: true, dateDebut: true, medicamentId: true, medicamentNom: true, protocoleVaccinId: true, etapeProtocoleVaccinId: true } }),
  ]);
  const plan = planifierMhe2026(animaux, vaccinations, traitements, medicament.id, protocole.id, etapes);
  return { medicament, protocole, config, plan, animaux };
}

export async function analyserMhe2026(): Promise<RapportMhe2026> {
  return (await preparer(prisma)).plan;
}

export async function appliquerMhe2026(): Promise<RapportMhe2026> {
  return prisma.$transaction(async (db) => {
    // Relecture dans la transaction : l'aperçu antérieur ne vaut jamais autorisation de forcer un conflit.
    const { medicament, protocole, config, plan, animaux } = await preparer(db);
    if (config.demarrage.type !== "PRIMO_RAPPEL") throw new Error("Configuration MHE invalide.");
    const modified = new Set<string>();
    for (const ligne of plan.lignes) {
      if (!ligne.animalId || !["RATTACHER", "CREER"].includes(ligne.action)) continue;
      const etapeId = ligne.etape === "Primo" ? config.demarrage.etapePrimoId : config.demarrage.etapeRappelId;
      if (ligne.action === "RATTACHER") {
        for (const id of ligne.vaccinationIds) await db.vaccination.update({ where: { id }, data: { medicamentId: medicament.id, protocoleId: protocole.id, etapeProtocoleId: etapeId } });
        for (const id of ligne.traitementIds) await db.traitement.update({ where: { id }, data: { protocoleVaccinId: protocole.id, etapeProtocoleVaccinId: etapeId } });
      } else {
        const liaison = protocole.etapes.find((etape) => etape.id === etapeId)?.medicaments.find((item) => item.medicamentId === medicament.id);
        const rappel = config.demarrage.rappel;
        const primoConnue = plan.lignes.find((item) => item.animalId === ligne.animalId && item.etape === "Primo");
        const animal = animaux.find((item) => item.id === ligne.animalId);
        const branche = rappel.type === "BRANCHES_AGE_PRIMO" && animal && primoConnue
          ? choisirBrancheAgePrimo(config, animal.danais, dateHistorique(primoConnue.date)) : null;
        const preconisationId = rappel.type === "BRANCHES_AGE_PRIMO"
          ? ligne.etape === "Primo" ? branche?.preconisationPrimoId : branche?.preconisationRappelId
          : liaison?.preconisationId ?? (ligne.etape === "Primo" ? rappel.preconisationPrimoId : rappel.preconisationRappelId);
        const preconisation = preconisationId ? await db.preconisation.findUnique({ where: { id: preconisationId }, select: { medicamentId: true, dose: true, voie: true } }) : null;
        if (preconisation && preconisation.medicamentId !== medicament.id) throw new Error("Préconisation de l'étape liée à un autre médicament.");
        await db.vaccination.create({ data: { animalId: ligne.animalId, vaccin: medicament.nom, medicamentId: medicament.id, date: dateHistorique(ligne.date), protocoleId: protocole.id, etapeProtocoleId: etapeId, ...(preconisation?.dose != null ? { dose: preconisation.dose } : {}), ...(preconisation?.voie ? { voie: preconisation.voie } : {}) } });
      }
      modified.add(ligne.animalId);
    }
    for (const animalId of modified) await resynchroniserStatutProtocole(animalId, protocole.id, db);
    return { ...plan, rattaches: plan.aRattacher, crees: plan.aCreer };
  }, { timeout: 120000 });
}

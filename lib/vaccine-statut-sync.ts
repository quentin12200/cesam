import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { statutDepuisEtapesFaites } from "@/lib/vaccine-statut";
import { brancheInitialeDepuisActes, lireConfigurationQuestionnaire } from "@/lib/vaccine-protocol-questionnaire";

/**
 * Après une correction d'étape, remet `StatutProtocoleVaccinal` en cohérence avec les actes réels
 * (Vaccination + Traitement rattaché). Pour un protocole questionnaire, la branche initiale
 * suit toujours les actes réels, même si le statut métier a été posé à la main.
 */
export async function resynchroniserStatutProtocole(animalId: string, protocoleId: string, db: Prisma.TransactionClient = prisma): Promise<void> {
  const statut = await db.statutProtocoleVaccinal.findUnique({
    where: { animalId_protocoleId: { animalId, protocoleId } },
    select: { id: true, statut: true, source: true, brancheInitialeId: true },
  });
  const [protocole, vaccinations, traitements, animal] = await Promise.all([
    db.protocoleVaccin.findUnique({ where: { id: protocoleId }, select: { configurationQuestionnaireJson: true, etapes: { select: { id: true, cycle: true, obligatoire: true } } } }),
    db.vaccination.findMany({ where: { animalId, protocoleId, statut: "FAIT", etapeProtocoleId: { not: null } }, select: { etapeProtocoleId: true, date: true } }),
    db.traitement.findMany({ where: { animalId, protocoleVaccinId: protocoleId, etapeProtocoleVaccinId: { not: null } }, select: { etapeProtocoleVaccinId: true, dateDebut: true } }),
    db.animal.findUnique({ where: { id: animalId }, select: { danais: true } }),
  ]);
  if (!protocole) return;
  const faites = new Set<string>([
    ...vaccinations.map((item) => item.etapeProtocoleId!),
    ...traitements.map((item) => item.etapeProtocoleVaccinId!),
  ]);
  const attendu = statutDepuisEtapesFaites(protocole.etapes, faites);
  const configuration = lireConfigurationQuestionnaire(protocole.configurationQuestionnaireJson);
  // Le chemin legacy reste rigoureusement identique : il ne connaît pas la branche et ne
  // remplace pas un statut lorsque plus aucune étape ne permet d'en déduire un.
  if (!configuration) {
    if (!statut || statut.source !== "VACCINATION") return;
    if (attendu && attendu !== statut.statut) {
      await db.statutProtocoleVaccinal.update({ where: { id: statut.id }, data: { statut: attendu } });
    }
    return;
  }
  const brancheInitialeId = animal
    ? brancheInitialeDepuisActes(configuration, animal.danais, [
        ...vaccinations.map((item) => ({ etapeProtocoleId: item.etapeProtocoleId, date: item.date })),
        ...traitements.map((item) => ({ etapeProtocoleId: item.etapeProtocoleVaccinId, date: item.dateDebut })),
      ])
    : null;
  if (!statut) {
    if (!attendu) return;
    await db.statutProtocoleVaccinal.create({
      data: {
        animalId,
        protocoleId,
        statut: attendu,
        source: "VACCINATION",
        confirmeAt: new Date(),
        brancheInitialeId,
      },
    });
    return;
  }
  // Une décision manuelle reste prioritaire pour le statut. La branche n'est toutefois pas
  // une décision : elle décrit la date de la Primo réellement effectuée et doit suivre ses corrections.
  if (statut.source !== "VACCINATION") {
    if (brancheInitialeId !== statut.brancheInitialeId) {
      await db.statutProtocoleVaccinal.update({ where: { id: statut.id }, data: { brancheInitialeId } });
    }
    return;
  }
  const statutAttendu = attendu ?? "A_CONFIRMER";
  if (statutAttendu !== statut.statut || brancheInitialeId !== statut.brancheInitialeId) {
    await db.statutProtocoleVaccinal.update({ where: { id: statut.id }, data: { statut: statutAttendu, brancheInitialeId } });
  }
}

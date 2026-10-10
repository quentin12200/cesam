import { prisma } from "@/lib/prisma";
import { statutDepuisEtapesFaites } from "@/lib/vaccine-statut";
import { brancheInitialeDepuisActes, lireConfigurationQuestionnaire } from "@/lib/vaccine-protocol-questionnaire";

/**
 * Après une correction d'étape, remet `StatutProtocoleVaccinal` en cohérence avec les actes réels
 * (Vaccination + Traitement rattaché). Pour un protocole questionnaire, la branche initiale
 * suit toujours les actes réels, même si le statut métier a été posé à la main.
 */
export async function resynchroniserStatutProtocole(animalId: string, protocoleId: string): Promise<void> {
  const statut = await prisma.statutProtocoleVaccinal.findUnique({
    where: { animalId_protocoleId: { animalId, protocoleId } },
    select: { id: true, statut: true, source: true, brancheInitialeId: true },
  });
  const [protocole, vaccinations, traitements, animal] = await Promise.all([
    prisma.protocoleVaccin.findUnique({ where: { id: protocoleId }, select: { configurationQuestionnaireJson: true, etapes: { select: { id: true, cycle: true, obligatoire: true } } } }),
    prisma.vaccination.findMany({ where: { animalId, protocoleId, statut: "FAIT", etapeProtocoleId: { not: null } }, select: { etapeProtocoleId: true, date: true } }),
    prisma.traitement.findMany({ where: { animalId, protocoleVaccinId: protocoleId, etapeProtocoleVaccinId: { not: null } }, select: { etapeProtocoleVaccinId: true, dateDebut: true } }),
    prisma.animal.findUnique({ where: { id: animalId }, select: { danais: true } }),
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
      await prisma.statutProtocoleVaccinal.update({ where: { id: statut.id }, data: { statut: attendu } });
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
    await prisma.statutProtocoleVaccinal.create({
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
      await prisma.statutProtocoleVaccinal.update({ where: { id: statut.id }, data: { brancheInitialeId } });
    }
    return;
  }
  const statutAttendu = attendu ?? "A_CONFIRMER";
  if (statutAttendu !== statut.statut || brancheInitialeId !== statut.brancheInitialeId) {
    await prisma.statutProtocoleVaccinal.update({ where: { id: statut.id }, data: { statut: statutAttendu, brancheInitialeId } });
  }
}

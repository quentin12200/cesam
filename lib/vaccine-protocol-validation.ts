import "server-only";
import { prisma } from "@/lib/prisma";
import type { ConfigurationQuestionnaireV1 } from "@/lib/vaccine-protocol-questionnaire";

export function preconisationsConfiguration(configuration: ConfigurationQuestionnaireV1): string[] {
  const ids: string[] = [];
  if (configuration.demarrage.type === "DOSE_UNIQUE") ids.push(configuration.demarrage.preconisationId);
  else if (configuration.demarrage.rappel.type === "DELAI_FIXE") ids.push(configuration.demarrage.rappel.preconisationPrimoId, configuration.demarrage.rappel.preconisationRappelId);
  else for (const branche of configuration.demarrage.rappel.branches) ids.push(branche.preconisationPrimoId, branche.preconisationRappelId);
  if (configuration.entretien.actif) ids.push(configuration.entretien.preconisationId);
  return [...new Set(ids)];
}

export async function referencesPharmacieValides(configuration: ConfigurationQuestionnaireV1): Promise<boolean> {
  const ids = preconisationsConfiguration(configuration);
  const [medicament, preconisations] = await Promise.all([
    prisma.medicament.findFirst({ where: { id: configuration.medicamentId, actif: true, categorie: "VACCIN" }, select: { id: true } }),
    prisma.preconisation.findMany({ where: { id: { in: ids }, medicamentId: configuration.medicamentId, statut: "VALIDE", dose: { not: null } }, select: { id: true } }),
  ]);
  return Boolean(medicament) && preconisations.length === ids.length;
}

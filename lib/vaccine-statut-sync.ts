import { prisma } from "@/lib/prisma";
import { statutDepuisEtapesFaites } from "@/lib/vaccine-statut";

/**
 * Après une correction d'étape, remet `StatutProtocoleVaccinal` en cohérence avec les actes réels
 * (Vaccination + Traitement rattaché). Ne touche qu'un statut déjà déduit d'une vaccination
 * (source VACCINATION) : un statut posé à la main reste la décision de l'utilisateur.
 */
export async function resynchroniserStatutProtocole(animalId: string, protocoleId: string): Promise<void> {
  const statut = await prisma.statutProtocoleVaccinal.findUnique({
    where: { animalId_protocoleId: { animalId, protocoleId } },
    select: { id: true, statut: true, source: true },
  });
  if (!statut || statut.source !== "VACCINATION") return;
  const [protocole, vaccinations, traitements] = await Promise.all([
    prisma.protocoleVaccin.findUnique({ where: { id: protocoleId }, select: { etapes: { select: { id: true, cycle: true, obligatoire: true } } } }),
    prisma.vaccination.findMany({ where: { animalId, protocoleId, statut: "FAIT", etapeProtocoleId: { not: null } }, select: { etapeProtocoleId: true } }),
    prisma.traitement.findMany({ where: { animalId, protocoleVaccinId: protocoleId, etapeProtocoleVaccinId: { not: null } }, select: { etapeProtocoleVaccinId: true } }),
  ]);
  if (!protocole) return;
  const faites = new Set<string>([
    ...vaccinations.map((item) => item.etapeProtocoleId!),
    ...traitements.map((item) => item.etapeProtocoleVaccinId!),
  ]);
  const attendu = statutDepuisEtapesFaites(protocole.etapes, faites);
  if (attendu && attendu !== statut.statut) {
    await prisma.statutProtocoleVaccinal.update({ where: { id: statut.id }, data: { statut: attendu } });
  }
}
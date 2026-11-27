import { prisma } from "@/lib/prisma";
import { type ProtocoleGrille } from "@/lib/vaccine-grid";
import { resoudreAdministrationEtape } from "@/lib/vaccine-administration";
export function readGridProtocols() { return prisma.protocoleVaccin.findMany({
      where: { actif: true },
      orderBy: { ordre: "asc" },
      include: {
        etapes: {
          orderBy: { ordre: "asc" },
          include: {
            medicaments: {
              where: { alternative: false },
              select: {
                medicamentId: true,
                voie: true,
                preconisationId: true,
                medicament: {
                  select: {
                    id: true,
                    nom: true,
                    voie: true,
                    uniteDosage: true,
                    preconisations: { select: { id: true, statut: true, voie: true, dose: true, unite: true } },
                  },
                },
              },
            },
          },
        },
      },
    }); }
export function projectGridProtocols(protocolesDb: Awaited<ReturnType<typeof readGridProtocols>>): ProtocoleGrille[] {
  return protocolesDb.map((protocole) => ({
    id: protocole.id, nom: protocole.nom, label: protocole.label,
    configurationQuestionnaireJson: protocole.configurationQuestionnaireJson,
    ageMinJours: protocole.ageMinJours, ageMaxJours: protocole.ageMaxJours,
    categoriesJson: protocole.categoriesJson, sexeCible: protocole.sexeCible, gestante: protocole.gestante,
    rangVelageMin: protocole.rangVelageMin, rangVelageMax: protocole.rangVelageMax, lotCible: protocole.lotCible,
    etapes: protocole.etapes.map((etape) => {
      const liaison = etape.medicaments[0] ?? null;
      const medicament = liaison?.medicament ?? null;
      // Pharmacie = vérité : voie + dose viennent des préconisations du médicament (voir lib/vaccine-administration.ts).
      const administration = resoudreAdministrationEtape({
        preconisations: medicament?.preconisations ?? [],
        preconisationLieeId: liaison?.preconisationId,
        voieLiaison: liaison?.voie,
        voieMedicament: medicament?.voie,
        uniteMedicament: medicament?.uniteDosage,
      });
      return {
        id: etape.id, label: etape.label, ordre: etape.ordre, cycle: etape.cycle, reference: etape.reference,
        debutValeur: etape.debutValeur, debutUnite: etape.debutUnite, debutPosition: etape.debutPosition,
        finValeur: etape.finValeur, finUnite: etape.finUnite, finPosition: etape.finPosition,
        dateFixe: etape.dateFixe, recurrenceMois: etape.recurrenceMois, obligatoire: etape.obligatoire,
        medicamentId: liaison?.medicamentId ?? null,
        medicamentNom: medicament?.nom ?? null,
        voie: administration.voie ?? "À renseigner",
        dose: administration.dose,
        uniteDosage: administration.unite,
        preconisations: medicament?.preconisations.filter((item) => item.statut === "VALIDE" && item.dose != null).map((item) => ({ id: item.id, voie: item.voie, dose: item.dose, unite: item.unite })) ?? [],
        medicaments: etape.medicaments.map((item) => ({ medicament: { id: item.medicament.id, nom: item.medicament.nom } })),
      };
    }),
  }));
}

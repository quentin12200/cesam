import type { MedicamentCandidat } from "./ordonnance-extraction.ts";

export interface MedicamentCandidateRecord {
  id: string;
  nom: string;
  dci: string | null;
  forme: string | null;
  categorie: string;
  voie: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  dosagePourKg?: number | null;
  uniteDosage?: string | null;
  actif?: boolean;
  aliasesVocaux?: Array<{ alias: string; transcription: string }>;
  preconisations?: Array<{
    dose: number | null;
    unite: string | null;
    doseBase: string | null;
    voie: string | null;
    frequence: string | null;
    delaiAttenteViandeJ: number | null;
    delaiAttenteLaitTraites: number | null;
    statut: string;
  }>;
  conditionnements?: Array<{ quantiteFlacon: number | null; uniteFlacon: string | null }>;
}

export const MEDICAMENTS_ORDONNANCE_QUERY = {
  orderBy: { nom: "asc" as const },
  select: {
    id: true,
    nom: true,
    dci: true,
    forme: true,
    categorie: true,
    voie: true,
    delaiAttenteViandeJ: true,
    delaiAttenteLaitJ: true,
    dosagePourKg: true,
    uniteDosage: true,
    actif: true,
    aliasesVocaux: { select: { alias: true, transcription: true } },
    preconisations: {
      select: {
        dose: true,
        unite: true,
        doseBase: true,
        voie: true,
        frequence: true,
        delaiAttenteViandeJ: true,
        delaiAttenteLaitTraites: true,
        statut: true,
      },
      orderBy: { createdAt: "asc" as const },
    },
    conditionnements: {
      where: { actif: true },
      select: { quantiteFlacon: true, uniteFlacon: true },
      orderBy: { createdAt: "asc" as const },
    },
  },
};

type FindManyMedicaments = (
  args: typeof MEDICAMENTS_ORDONNANCE_QUERY,
) => PromiseLike<MedicamentCandidateRecord[]>;

/** Source unique des fiches utilisables pour rapprocher une ordonnance.
 * Les fiches inactives restent candidates afin d'éviter les doublons. */
export async function chargerCandidatsOrdonnance(
  findMany: FindManyMedicaments,
): Promise<MedicamentCandidat[]> {
  const medicaments = await findMany(MEDICAMENTS_ORDONNANCE_QUERY);
  return medicaments.map((medicament) => ({
    id: medicament.id,
    nom: medicament.nom,
    dci: medicament.dci,
    forme: medicament.forme,
    categorie: medicament.categorie,
    voie: medicament.voie,
    delaiAttenteViandeJ: medicament.delaiAttenteViandeJ,
    delaiAttenteLaitJ: medicament.delaiAttenteLaitJ,
    dosagePourKg: medicament.dosagePourKg,
    uniteDosage: medicament.uniteDosage,
    preconisations: medicament.preconisations ?? [],
    conditionnements: medicament.conditionnements ?? [],
    actif: medicament.actif !== false,
    aliases: (medicament.aliasesVocaux ?? []).flatMap((alias) => [alias.alias, alias.transcription]),
  }));
}

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
  actif?: boolean;
  aliasesVocaux?: Array<{ alias: string; transcription: string }>;
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
    actif: true,
    aliasesVocaux: { select: { alias: true, transcription: true } },
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
    actif: medicament.actif !== false,
    aliases: (medicament.aliasesVocaux ?? []).flatMap((alias) => [alias.alias, alias.transcription]),
  }));
}

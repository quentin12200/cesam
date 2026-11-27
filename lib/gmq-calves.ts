import { conflictingFatherIdentity } from "./gmq-father-conflict.ts";
type Bull = { id: string; nopere: string | null; nupere: string | null };
type Animal = { id: string; nutrav: string; nobovi: string | null; danais: Date | null; sexbov: string; pereNomManuel: string | null; pereNationalManuel: string | null; pereTravailManuel: string | null; taureau: Bull | null; pesees: { date: Date; poids: number }[] };
type Birth = { vacheId: string; vache: { nutrav: string; nobovi: string | null }; pereNom: string | null; pereNunati: string | null; gestation: { saillie: { taureau: Bull | null } | null } | null; veau: Animal | null; veauxDetails: { animal: Animal | null }[] };

export function mapGmqCalves(velages: Birth[]) {
  const seen = new Set<string>();
  const veaux = velages.flatMap(v => [v.veau, ...v.veauxDetails.map(d => d.animal)].flatMap(calf => {
    if (!calf || !calf.danais || seen.has(calf.id)) return [];
    seen.add(calf.id);
    const bull = calf.taureau ?? v.gestation?.saillie?.taureau;
    // The calf genealogy is the primary source. Older births may store father
    // information on the calving or the linked breeding record instead.
    // NUMEIP/NOMEIP/TRAMIP describe the MOTHER (identification permanente),
    // never the father. Only use explicitly paternal sources here.
    const fatherNational = calf.pereNationalManuel?.trim()
      || bull?.nupere?.trim() || v.pereNunati?.trim() || null;
    const fatherName = calf.pereNomManuel?.trim()
      || bull?.nopere?.trim() || v.pereNom?.trim()
      || calf.pereTravailManuel?.trim()
      || fatherNational || null;
    const fatherSource = calf.pereNomManuel?.trim() || calf.pereNationalManuel?.trim() || calf.pereTravailManuel?.trim()
      ? "Filiation manuelle du veau"
      : calf.taureau?.nopere?.trim() || calf.taureau?.nupere?.trim()
        ? "Taureau lié au veau"
        : v.gestation?.saillie?.taureau?.nopere?.trim() || v.gestation?.saillie?.taureau?.nupere?.trim()
          ? "Taureau de la gestation"
          : v.pereNom?.trim() || v.pereNunati?.trim()
            ? "Père indiqué au vêlage"
            : null;
    const fatherMissing = [
      ...(!calf.pereNomManuel?.trim() && !calf.pereNationalManuel?.trim() && !calf.pereTravailManuel?.trim() ? ["Filiation manuelle du veau non renseignée"] : []),
      ...(!calf.taureau?.nopere?.trim() && !calf.taureau?.nupere?.trim() ? ["Aucune identité sur le taureau lié au veau"] : []),
      ...(!v.gestation?.saillie?.taureau?.nopere?.trim() && !v.gestation?.saillie?.taureau?.nupere?.trim() ? ["Aucun taureau identifié sur la gestation"] : []),
      ...(!v.pereNom?.trim() && !v.pereNunati?.trim() ? ["Père non renseigné au vêlage"] : []),
    ];
    const conflict = conflictingFatherIdentity([
      { national: calf.pereNationalManuel, name: calf.pereNomManuel },
      { national: calf.taureau?.nupere, name: calf.taureau?.nopere },
      { national: v.gestation?.saillie?.taureau?.nupere, name: v.gestation?.saillie?.taureau?.nopere },
      { national: v.pereNunati, name: v.pereNom },
    ]);
    if (conflict) fatherMissing.push("Sources paternelles contradictoires : validation nécessaire");
    return [{
      id: calf.id, numero: calf.nutrav, nom: calf.nobovi,
      naissance: calf.danais.toISOString(), sexe: calf.sexbov,
      mereId: v.vacheId, mere: [v.vache.nutrav, v.vache.nobovi].filter(Boolean).join(" · "),
      pereId: conflict ? null : bull?.id ?? null,
      pereNational: conflict ? null : fatherNational,
      pere: conflict ? null : fatherName,
      fatherSource: conflict ? null : fatherSource, fatherMissing,
      pesees: calf.pesees.map(p => ({ date: p.date.toISOString(), poids: p.poids })),
    }];
  }));
  return veaux;
}

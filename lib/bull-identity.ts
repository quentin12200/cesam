import type { AncestrySearchMatch } from "./animal-genealogy";

export function canonicalNational(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, "").replace(/^FR/i, "").toUpperCase();
}

// Conserver le code pays dans les identifiants affichés et enregistrés.
// Les anciens numéros français à 10 chiffres reçoivent FR ; un UK explicite
// n'est jamais converti en FR. Les numéros courts restent courts.
export function nationalWithCountry(value: string | null | undefined): string {
  const raw = (value ?? "").replace(/\s+/g, "").toUpperCase();
  if (/^[A-Z]{2}[A-Z0-9]+$/.test(raw)) return raw;
  if (/^\d{10}$/.test(raw)) return `FR${raw}`;
  return raw;
}

export function canonicalName(value: string | null | undefined): string {
  return (value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toUpperCase();
}

export function fullNational(value: string | null | undefined): string | null {
  const number = canonicalNational(value);
  return /^\d{8,15}$/.test(number) ? number : null;
}

export function sameBullCandidates(a: { nupere: string; nopere: string | null }, b: { nupere: string; nopere: string | null }): "CERTAIN" | "A_VERIFIER" | null {
  const left = fullNational(a.nupere);
  const right = fullNational(b.nupere);
  if (left && right) return left === right ? "CERTAIN" : null;
  const numberA = canonicalNational(a.nupere);
  const numberB = canonicalNational(b.nupere);
  const shortA = numberA.slice(-4);
  const shortB = numberB.slice(-4);
  if (shortA.length !== 4 || shortA !== shortB) return null;
  const nameA = canonicalName(a.nopere);
  const nameB = canonicalName(b.nopere);
  if (!nameA || nameA !== nameB) return null;
  return "A_VERIFIER";
}

// Une référence IA saisie avec son nom (ARGUS/Argus) est un alias
// possible, jamais une preuve suffisante pour un regroupement automatique.
export function isNamedBullAlias(
  keep: { nupere: string; nopere: string | null },
  remove: { nupere: string; nopere: string | null },
): boolean {
  if (!fullNational(keep.nupere) || fullNational(remove.nupere)) return false;
  const name = canonicalName(keep.nopere);
  return name.length >= 3
    && name === canonicalName(remove.nopere)
    && canonicalName(remove.nupere) === name;
}

// Une référence historique courte n'est masquée que si un seul taureau
// correspond au numéro de travail ET au nom, sinon on la laisse visible.
export function reconcileFatherSearch(matches: AncestrySearchMatch[]): AncestrySearchMatch[] {
  const priority = { ANIMAL: 0, TAUREAU: 1, HISTORIQUE: 2, VELAGE: 3 };
  const groups = new Map<string, AncestrySearchMatch[]>();
  for (const match of matches) {
    const complete = fullNational(match.nationalNumber);
    const key = complete
      ? `national:${complete}`
      : `ref:${match.source}:${match.sourceId ?? ""}:${match.workNumber ?? ""}:${match.name ?? ""}`;
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }
  const merged: AncestrySearchMatch[] = [];
  for (const group of groups.values()) {
    const distinctBulls = new Map(group.filter((m) => m.source === "TAUREAU" && m.sourceId).map((m) => [m.sourceId, m]));
    if (distinctBulls.size > 1) {
      merged.push(...distinctBulls.values());
    } else {
      merged.push(group.sort((a, b) => priority[a.source] - priority[b.source])[0]);
    }
  }
  const fullBulls = merged.filter((m) => m.source === "TAUREAU" && fullNational(m.nationalNumber));
  return merged.filter((match) => {
    if (match.source !== "HISTORIQUE" && match.source !== "VELAGE") return true;
    if (fullNational(match.nationalNumber)) return true;
    const short = (match.workNumber ?? canonicalNational(match.nationalNumber).slice(-4)).trim();
    const name = canonicalName(match.name);
    if (short.length !== 4 || !name) return true;
    const matching = fullBulls.filter((bull) =>
      canonicalNational(bull.nationalNumber).endsWith(short) && canonicalName(bull.name) === name
    );
    return matching.length !== 1;
  });
}

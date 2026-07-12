export function normalizeSearch(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // suppression
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

/**
 * Score de correspondance tolérant : 0 = pas de correspondance.
 * Plus le score est élevé, meilleure est la correspondance.
 * Tolère fautes de frappe, accents, casse, saisie partielle.
 */
function matchScore(query: string, candidate: string): number {
  const q = normalizeSearch(query);
  const c = normalizeSearch(candidate);
  if (!q) return 0;

  if (c === q) return 100;
  if (c.startsWith(q)) return 90;
  if (c.includes(q)) return 80;

  // Tolère une faute de frappe pour les saisies courtes/partielles
  // (ex: "mamite" -> "mammite", "cesarienne" -> "césarienne" déjà géré par la normalisation)
  const maxDistance = Math.max(1, Math.floor(q.length / 4));
  const words = c.split(" ");
  for (const word of words) {
    const prefix = word.slice(0, q.length + maxDistance);
    const dist = levenshtein(q, prefix.length > 0 ? prefix : word);
    if (dist <= maxDistance) {
      return Math.max(10, 70 - dist * 15);
    }
  }

  const distFull = levenshtein(q, c);
  if (distFull <= maxDistance + 1) {
    return Math.max(5, 60 - distFull * 15);
  }

  return 0;
}

export interface RecherchableTypeEvenement {
  id: string;
  nom: string;
  synonymes?: string | null;
}

export interface ResultatRecherche<T> {
  item: T;
  score: number;
}

export function searchTypesEvenement<T extends RecherchableTypeEvenement>(
  query: string,
  types: T[]
): ResultatRecherche<T>[] {
  const q = query.trim();
  if (!q) return [];

  const results: ResultatRecherche<T>[] = [];
  for (const type of types) {
    let best = matchScore(q, type.nom);
    if (type.synonymes) {
      for (const syn of type.synonymes.split(",")) {
        const s = matchScore(q, syn.trim());
        if (s > best) best = s;
      }
    }
    if (best > 0) results.push({ item: type, score: best });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

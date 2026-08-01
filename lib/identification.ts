export function normaliserNutrav(value: string, chiffres: number, zerosGauche: boolean) {
  const brut = value.trim();
  return zerosGauche && /^\d+$/.test(brut) ? brut.padStart(chiffres, "0") : brut.toUpperCase();
}

export function numeroNationalDuLot(premier: string, index: number) {
  const match = premier.match(/^(.*?)(\d+)$/);
  if (!match) return index === 0 ? premier : "";
  const [, prefixe, chiffres] = match;
  const valeur = Number(chiffres) + index;
  if (!Number.isSafeInteger(valeur) || valeur < 0) return "";
  const suffixe = String(valeur);
  if (suffixe.length > chiffres.length) return "";
  return `${prefixe}${suffixe.padStart(chiffres.length, "0")}`;
}

export const MAX_LOT_GENERATION_ITERATIONS = 10_000;

export interface NumeroIdentificationUtilise {
  nutrav: string | null;
  nunati: string | null;
  utilisePar?: string | null;
}

export interface NumeroLotGenere {
  nutrav: string;
  nunati: string;
  offset: number;
}

export interface NumeroLotSaute extends NumeroLotGenere {
  utilisePar: string | null;
}

export interface GenerationLotBoucles {
  numeros: NumeroLotGenere[];
  sautes: NumeroLotSaute[];
  premierNumero: string;
  dernierNumero: string;
  iterations: number;
}

/**
 * Génère exactement `quantite` identifications libres. Les numéros occupés
 * prolongent la série et ne sont jamais comptés dans la quantité demandée.
 */
export function genererNumerosLibresDuLot(
  premierNunati: string,
  quantite: number,
  utilises: NumeroIdentificationUtilise[],
  maxIterations: number = MAX_LOT_GENERATION_ITERATIONS
): GenerationLotBoucles {
  if (!Number.isInteger(quantite) || quantite < 1) {
    throw new Error("La quantité de boucles doit être un entier positif.");
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new Error("La limite de génération est invalide.");
  }

  const parNutrav = new Map<string, string | null>();
  const parNunati = new Map<string, string | null>();
  for (const utilise of utilises) {
    if (utilise.nutrav) parNutrav.set(utilise.nutrav, utilise.utilisePar ?? null);
    if (utilise.nunati) parNunati.set(utilise.nunati, utilise.utilisePar ?? null);
  }

  const numeros: NumeroLotGenere[] = [];
  const sautes: NumeroLotSaute[] = [];
  const generesNutrav = new Set<string>();
  const generesNunati = new Set<string>();
  let iterations = 0;

  for (let offset = 0; numeros.length < quantite && iterations < maxIterations; offset += 1) {
    iterations += 1;
    const nunati = numeroNationalDuLot(premierNunati, offset);
    if (!nunati) break;
    const nutrav = nunati.slice(-4);
    const utilisePar = parNutrav.get(nutrav) ?? parNunati.get(nunati) ?? null;
    const occupe =
      parNutrav.has(nutrav) ||
      parNunati.has(nunati) ||
      generesNutrav.has(nutrav) ||
      generesNunati.has(nunati);

    if (occupe) {
      sautes.push({ nutrav, nunati, offset, utilisePar });
      continue;
    }

    numeros.push({ nutrav, nunati, offset });
    generesNutrav.add(nutrav);
    generesNunati.add(nunati);
  }

  if (numeros.length !== quantite) {
    throw new Error(
      `Impossible de trouver ${quantite} numéros libres dans la limite de ${maxIterations} essais.`
    );
  }

  return {
    numeros,
    sautes,
    premierNumero: numeros[0].nunati,
    dernierNumero: numeros[numeros.length - 1].nunati,
    iterations,
  };
}

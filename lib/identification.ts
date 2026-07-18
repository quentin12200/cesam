export function normaliserNutrav(value: string, chiffres: number, zerosGauche: boolean) {
  const brut = value.trim();
  return zerosGauche && /^\d+$/.test(brut) ? brut.padStart(chiffres, "0") : brut.toUpperCase();
}

export function numeroNationalDuLot(premier: string, index: number) {
  const match = premier.match(/^(.*?)(\d+)$/);
  if (!match) return index === 0 ? premier : "";
  const [, prefixe, chiffres] = match;
  return `${prefixe}${String(Number(chiffres) + index).padStart(chiffres.length, "0")}`;
}

export function propositionLot(lot: { premierNutrav: string; premierNunati: string; prochainIndex: number }, chiffres: number, zerosGauche: boolean, decalage = 0) {
  const index = lot.prochainIndex + decalage;
  const nutrav = normaliserNutrav(String(Number(lot.premierNutrav) + index), chiffres, zerosGauche);
  return { nutrav, nunati: numeroNationalDuLot(lot.premierNunati, index) };
}

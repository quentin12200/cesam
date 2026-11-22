/** Lecture seule des champs du carnet : une ordonnance liée est la seule source de repli. */
export type OrdonnanceLieeCarnet = { numero?: string | null; veterinaireNom?: string | null } | null | undefined;
export function texteCarnet(valeur?: string | null): string | null {
  const nettoye = valeur?.trim();
  return nettoye ? nettoye : null;
}
export function numeroOrdonnanceCarnet(numeroActe?: string | null, ordonnance?: OrdonnanceLieeCarnet): string | null {
  return texteCarnet(numeroActe) ?? texteCarnet(ordonnance?.numero);
}
export function prescripteurCarnet(prescripteurActe?: string | null, ordonnance?: OrdonnanceLieeCarnet): string | null {
  return texteCarnet(prescripteurActe) ?? texteCarnet(ordonnance?.veterinaireNom);
}

export function formaterNomMarchand(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("fr-FR");
}

export function cleNomMarchand(value: string) {
  return formaterNomMarchand(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

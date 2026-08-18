export function ajouterPagesOrdonnance<T>(pages: readonly T[], nouvellesPages: Iterable<T>): T[] {
  return [...pages, ...nouvellesPages];
}

export function supprimerPageOrdonnance<T>(pages: readonly T[], index: number): T[] {
  if (!Number.isInteger(index) || index < 0 || index >= pages.length) return [...pages];
  return pages.filter((_, pageIndex) => pageIndex !== index);
}

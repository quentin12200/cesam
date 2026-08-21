function extensionPourType(type: string): string {
  if (type === "application/pdf") return "pdf";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  return "jpg";
}

/** Recharge les documents d'une ordonnance dans leur ordre d'origine afin de
 * les transmettre tels quels au pipeline multi-pages courant. */
export async function chargerPagesOrdonnance(
  documentUrls: string[],
  fetcher: typeof fetch = fetch,
): Promise<File[]> {
  const pages: File[] = [];

  for (const [index, url] of documentUrls.entries()) {
    const response = await fetcher(url);
    if (!response.ok) {
      throw new Error(`Le document original (page ${index + 1}) est inaccessible`);
    }
    const blob = await response.blob();
    const type = blob.type || "image/jpeg";
    pages.push(new File(
      [blob],
      `ordonnance-page-${index + 1}.${extensionPourType(type)}`,
      { type },
    ));
  }

  return pages;
}

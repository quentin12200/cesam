export function validateBreedingInput(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false as const, error: "Saisie invalide." };
  const input = body as Record<string, unknown>;
  const type = typeof input.type === "string" ? input.type.trim().toUpperCase() : "";
  const ids = Array.isArray(input.animalIds) ? input.animalIds : input.animalId != null ? [input.animalId] : [];
  if (ids.length === 0 || ids.some(id => typeof id !== "string" || !id.trim())) return { ok: false as const, error: "Animaux invalides." };
  const animalIds = [...new Set(ids as string[])];
  if (!["NATURELLE", "IA"].includes(type)) return { ok: false as const, error: "Type invalide." };
  const date = input.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(date)) return { ok: false as const, error: "Date invalide." };
  const parsedDate = new Date(date);
  if (Number.isNaN(parsedDate.getTime()) || (date.length === 10 && parsedDate.toISOString().slice(0, 10) !== date)) return { ok: false as const, error: "Date invalide." };
  if (input.taureauId != null && (typeof input.taureauId !== "string" || !input.taureauId.trim())) return { ok: false as const, error: "Taureau invalide." };
  if (input.tentative != null && (typeof input.tentative !== "number" || !Number.isInteger(input.tentative) || input.tentative < 1)) return { ok: false as const, error: "Tentative invalide." };
  return { ok: true as const, animalIds, date: parsedDate, type, taureauId: input.taureauId as string | undefined | null, tentative: (input.tentative as number | undefined) ?? 1 };
}

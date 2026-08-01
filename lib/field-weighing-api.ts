import type { FieldSessionEntry } from "./field-weighing";

type Fetcher = typeof fetch;

type CreatedWeight = {
  pesee: { id: string; poids: number };
  animal: {
    nutrav: string;
    sexe: string;
    mereNutrav: string | null;
    birthDate: string | null;
  };
  gmq: number | null;
};

type UpdatedWeight = {
  pesee: { id: string; poids: number };
  gmq: number | null;
};

async function readResult<T>(response: Response, fallback: string): Promise<T> {
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || fallback);
  return result;
}

export async function createFieldWeight(
  input: { nutrav: string; poids: number; date: string; sessionStartedAt: string },
  fetcher: Fetcher = fetch,
): Promise<FieldSessionEntry> {
  const response = await fetcher("/api/pesees", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await readResult<CreatedWeight>(response, "La pesée n’a pas pu être enregistrée.");
  return {
    id: result.pesee.id,
    nutrav: result.animal.nutrav,
    mereNutrav: result.animal.mereNutrav,
    birthDate: result.animal.birthDate,
    sexe: result.animal.sexe === "M" ? "M" : "F",
    poids: result.pesee.poids,
    gmq: result.gmq,
    selected: true,
  };
}

export async function updateFieldWeight(
  entry: FieldSessionEntry,
  poids: number,
  sessionStartedAt: string,
  fetcher: Fetcher = fetch,
): Promise<FieldSessionEntry> {
  const response = await fetcher(`/api/pesees/${entry.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ poids, sessionStartedAt }),
  });
  const result = await readResult<UpdatedWeight>(response, "La pesée n’a pas pu être modifiée.");
  return { ...entry, poids: result.pesee.poids, gmq: result.gmq };
}

export async function deleteFieldWeight(
  id: string,
  fetcher: Fetcher = fetch,
): Promise<void> {
  const response = await fetcher(`/api/pesees/${id}`, { method: "DELETE" });
  await readResult<{ success: true; id: string }>(response, "La pesée n’a pas pu être annulée.");
}

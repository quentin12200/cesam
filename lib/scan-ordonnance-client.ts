import { fileToDocumentDataUrl } from "@/lib/image-client";

export interface OrdonnanceExtracted {
  medicamentNom: string | null;
  voie: string | null;
  dose: number | null;
  uniteDosage: string | null;
  frequence: string | null;
  dureeJours: number | null;
  dateDebut: string | null;
  veterinaire: string | null;
  motif: string | null;
  delaiAttenteViandeJ: number | null;
  delaiAttenteLaitJ: number | null;
  precautions: string | null;
  rappels: string | null;
  ordonnanceNumero: string | null;
  raw: string;
  modele: string;
  versionPrompt: string;
  analyseLe: string;
}

export interface OrdonnanceScanResult {
  extractionId: string;
  extracted: OrdonnanceExtracted;
}

export async function scanAndCreateExtraction(file: File): Promise<OrdonnanceScanResult> {
  const dataUrl = await fileToDocumentDataUrl(file);
  const base64 = dataUrl.split(",")[1] ?? "";
  const documentMimeType = dataUrl.match(/^data:([^;,]+)/)?.[1] ?? file.type ?? "image/jpeg";

  const uploadRes = await fetch("/api/documents/ordonnances", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, contentType: documentMimeType }),
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error ?? "Le document n'a pas pu Ãªtre enregistrÃ©");
  }
  const { documentUrl } = await uploadRes.json();

  const scanRes = await fetch("/api/scan-ordonnance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mimeType: documentMimeType }),
  });
  if (!scanRes.ok) {
    const err = await scanRes.json();
    throw new Error(err.error ?? "Erreur lors du scan");
  }
  const extracted: OrdonnanceExtracted = await scanRes.json();
  const { raw, modele, versionPrompt, analyseLe, ...propositionInitiale } = extracted;
  const draftRes = await fetch("/api/extractions-ordonnance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentUrl,
      reponseBrute: raw,
      propositionInitiale,
      modele,
      versionPrompt,
      analyseLe,
    }),
  });
  if (!draftRes.ok) {
    const err = await draftRes.json().catch(() => ({}));
    throw new Error(err.error ?? "Le brouillon n'a pas pu Ãªtre crÃ©Ã©");
  }
  const draft = await draftRes.json();
  return { extractionId: draft.id, extracted };
}

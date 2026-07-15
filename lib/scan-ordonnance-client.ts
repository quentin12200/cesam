import { fileToDocumentDataUrl } from "@/lib/image-client";
import { uploadDataUrlToStorage } from "@/lib/firebase-client";

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

  const ext = file.type === "application/pdf" ? "pdf" : "jpg";
  const path = `ordonnances/extractions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const documentUrl = await uploadDataUrlToStorage(dataUrl, path);

  const scanRes = await fetch("/api/scan-ordonnance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mimeType: file.type || "image/jpeg" }),
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
    throw new Error(err.error ?? "Le brouillon n'a pas pu être créé");
  }
  const draft = await draftRes.json();
  return { extractionId: draft.id, extracted };
}

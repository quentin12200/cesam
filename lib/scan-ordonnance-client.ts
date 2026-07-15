import { fileToDocumentDataUrl } from "@/lib/image-client";
import type { MedicamentPropose, PropositionOrdonnance } from "@/lib/ordonnance-types";

export interface OrdonnanceExtracted extends PropositionOrdonnance {
  medicaments: MedicamentPropose[];
  raw: string;
  modele: string;
  versionPrompt: string;
  analyseLe: string;
}

export interface OrdonnanceScanResult {
  extractionId: string;
  extracted: OrdonnanceExtracted;
}

async function uploadDocument(file: File): Promise<{ documentUrl: string; base64: string; mimeType: string }> {
  const dataUrl = await fileToDocumentDataUrl(file);
  const base64 = dataUrl.split(",")[1] ?? "";
  const mimeType = dataUrl.match(/^data:([^;,]+)/)?.[1] ?? file.type ?? "image/jpeg";

  const uploadRes = await fetch("/api/documents/ordonnances", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, contentType: mimeType }),
  });
  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}));
    throw new Error(err.error ?? "Le document n'a pas pu être enregistré");
  }
  const { documentUrl } = await uploadRes.json();
  return { documentUrl, base64, mimeType };
}

/** Prend une ou plusieurs photos formant UNE ordonnance : chaque page est
 *  enregistrée, puis toutes les images sont analysées ensemble en un seul appel. */
export async function scanAndCreateExtraction(files: File[]): Promise<OrdonnanceScanResult> {
  const liste = files.filter(Boolean);
  if (liste.length === 0) throw new Error("Aucune photo sélectionnée");

  const pages = [];
  for (const file of liste) {
    pages.push(await uploadDocument(file));
  }
  const documentUrls = pages.map((p) => p.documentUrl);

  const scanRes = await fetch("/api/scan-ordonnance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images: pages.map((p) => ({ data: p.base64, mimeType: p.mimeType })) }),
  });
  if (!scanRes.ok) {
    const err = await scanRes.json().catch(() => ({}));
    throw new Error(err.error ?? "Erreur lors du scan");
  }
  const extracted: OrdonnanceExtracted = await scanRes.json();

  const { raw, modele, versionPrompt, analyseLe, ...proposition } = extracted;
  const draftRes = await fetch("/api/extractions-ordonnance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentUrl: documentUrls[0],
      documentUrls,
      reponseBrute: raw,
      propositionInitiale: proposition,
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

import { fileToDocumentDataUrl } from "@/lib/image-client";
import type { MedicamentPropose, PropositionOrdonnance } from "@/lib/ordonnance-types";
import {
  isOrdonnanceScanStage,
  ordonnanceScanUserMessage,
  type OrdonnanceScanStage,
} from "@/lib/ordonnance-scan-diagnostics";

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

async function scanFailureMessage(response: Response, fallbackStage: OrdonnanceScanStage): Promise<string> {
  const payload = await response.json().catch(() => null) as { error?: unknown; stage?: unknown } | null;
  if (payload && typeof payload.error === "string" && payload.error.trim()) return payload.error;
  const stage = payload && isOrdonnanceScanStage(payload.stage) ? payload.stage : fallbackStage;
  return ordonnanceScanUserMessage(stage);
}

async function uploadDocument(file: File): Promise<{ documentUrl: string; base64: string; mimeType: string }> {
  const dataUrl = await fileToDocumentDataUrl(file);
  const base64 = dataUrl.split(",")[1] ?? "";
  const mimeType = dataUrl.match(/^data:([^;,]+)/)?.[1] ?? file.type ?? "image/jpeg";

  let uploadRes: Response;
  try {
    uploadRes = await fetch("/api/documents/ordonnances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, contentType: mimeType }),
    });
  } catch {
    throw new Error(ordonnanceScanUserMessage("document"));
  }
  if (!uploadRes.ok) {
    throw new Error(await scanFailureMessage(uploadRes, "document"));
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

  let scanRes: Response;
  try {
    scanRes = await fetch("/api/scan-ordonnance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: pages.map((p) => ({ data: p.base64, mimeType: p.mimeType })) }),
    });
  } catch {
    throw new Error(ordonnanceScanUserMessage("openai_call"));
  }
  if (!scanRes.ok) {
    throw new Error(await scanFailureMessage(scanRes, "openai_call"));
  }
  const extracted: OrdonnanceExtracted = await scanRes.json();

  const { raw, modele, versionPrompt, analyseLe, ...proposition } = extracted;
  let draftRes: Response;
  try {
    draftRes = await fetch("/api/extractions-ordonnance", {
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
  } catch {
    throw new Error(ordonnanceScanUserMessage("database"));
  }
  if (!draftRes.ok) {
    throw new Error(await scanFailureMessage(draftRes, "database"));
  }
  const draft = await draftRes.json();
  return { extractionId: draft.id, extracted };
}

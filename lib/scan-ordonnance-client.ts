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
}

export interface OrdonnanceScanResult {
  ordonnanceId: string | null;
  extracted: OrdonnanceExtracted;
}

export async function scanAndPersistOrdonnance(file: File): Promise<OrdonnanceScanResult> {
  const dataUrl = await fileToDocumentDataUrl(file);
  const base64 = dataUrl.split(",")[1] ?? "";

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

  let ordonnanceId: string | null = null;
  try {
    const ext = file.type === "application/pdf" ? "pdf" : "jpg";
    const path = `ordonnances/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const photoUrl = await uploadDataUrlToStorage(dataUrl, path);
    const upsertRes = await fetch("/api/ordonnances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        numero: extracted.ordonnanceNumero,
        veterinaireNom: extracted.veterinaire,
        medicamentNom: extracted.medicamentNom ?? "",
        dose: extracted.dose,
        uniteDosage: extracted.uniteDosage,
        voie: extracted.voie,
        frequence: extracted.frequence,
        dureeJours: extracted.dureeJours,
        motif: extracted.motif,
        delaiAttenteViandeJ: extracted.delaiAttenteViandeJ,
        delaiAttenteLaitJ: extracted.delaiAttenteLaitJ,
        precautions: extracted.precautions,
        rappels: extracted.rappels,
        photoUrl,
      }),
    });
    if (upsertRes.ok) {
      const data = await upsertRes.json();
      ordonnanceId = data.id ?? null;
    }
  } catch {
    // le document n'a pas pu être conservé, on garde quand même les champs extraits
  }

  return { ordonnanceId, extracted };
}

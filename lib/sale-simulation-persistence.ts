import { isSaleWeightSource, weightForSource, type SaleSimulationLineInput } from "./sale-simulation.ts";

function optionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type ParsedSaleSimulation = {
  weighingSessionId: string | null;
  statut: "DRAFT" | "CONFIRMED";
  refactionGlobale: number;
  prixKgGlobal: number | null;
  lines: Array<SaleSimulationLineInput & { poidsUtilise: number }>;
};

export function parseSaleSimulationPayload(body: unknown): ParsedSaleSimulation {
  if (!body || typeof body !== "object") throw new Error("Simulation invalide.");
  const value = body as Record<string, unknown>;
  const refactionGlobale = Number(value.refactionGlobale ?? 0);
  const prixKgGlobal = optionalNumber(value.prixKgGlobal);
  if (!Number.isFinite(refactionGlobale) || refactionGlobale < 0 || refactionGlobale > 100) throw new Error("Réfaction invalide.");
  if (prixKgGlobal !== null && prixKgGlobal < 0) throw new Error("Prix au kilo invalide.");
  if (!Array.isArray(value.lines) || value.lines.length === 0) throw new Error("Sélectionnez au moins un animal.");

  const seen = new Set<string>();
  const lines = value.lines.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Ligne animale invalide.");
    const line = raw as Record<string, unknown>;
    if (typeof line.animalId !== "string" || !line.animalId || seen.has(line.animalId)) throw new Error("Animal invalide ou dupliqué.");
    seen.add(line.animalId);
    if (!isSaleWeightSource(line.source)) throw new Error("Source de poids invalide.");
    const parsed: SaleSimulationLineInput = {
      animalId: line.animalId,
      lastWeight: optionalNumber(line.lastWeight),
      lastWeightDate: typeof line.lastWeightDate === "string" && !Number.isNaN(new Date(line.lastWeightDate).getTime()) ? line.lastWeightDate : null,
      gmq: optionalNumber(line.gmq),
      predictedWeight: optionalNumber(line.predictedWeight),
      merchantWeight: optionalNumber(line.merchantWeight),
      manualWeight: optionalNumber(line.manualWeight),
      source: line.source,
      individualRefaction: optionalNumber(line.individualRefaction),
      individualPriceKg: optionalNumber(line.individualPriceKg),
    };
    const poidsUtilise = weightForSource(parsed);
    if (poidsUtilise === null) throw new Error("Le poids choisi est indisponible pour un animal.");
    if (parsed.individualRefaction !== null && (parsed.individualRefaction < 0 || parsed.individualRefaction > 100)) throw new Error("Réfaction individuelle invalide.");
    if (parsed.individualPriceKg !== null && parsed.individualPriceKg < 0) throw new Error("Prix individuel invalide.");
    return { ...parsed, poidsUtilise };
  });

  return {
    weighingSessionId: typeof value.weighingSessionId === "string" && value.weighingSessionId ? value.weighingSessionId : null,
    statut: value.statut === "CONFIRMED" ? "CONFIRMED" : "DRAFT",
    refactionGlobale,
    prixKgGlobal,
    lines,
  };
}

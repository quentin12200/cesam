export type OrdonnanceScanStage =
  | "document"
  | "pharmacy_candidates"
  | "openai_call"
  | "openai_response"
  | "transcription"
  | "database";

const USER_MESSAGES: Record<OrdonnanceScanStage, string> = {
  document: "Le scan a échoué pendant le téléversement du document",
  pharmacy_candidates: "Le scan a échoué pendant le chargement de la Pharmacie",
  openai_call: "Le scan a échoué pendant l’analyse IA",
  openai_response: "Le scan a échoué pendant la lecture de la réponse IA",
  transcription: "Le scan a échoué pendant l’analyse du document",
  database: "Le scan a échoué pendant l’enregistrement",
};

export function isOrdonnanceScanStage(value: unknown): value is OrdonnanceScanStage {
  return typeof value === "string" && value in USER_MESSAGES;
}

export function ordonnanceScanUserMessage(stage: OrdonnanceScanStage): string {
  return USER_MESSAGES[stage];
}

function redactSecrets(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
    .replace(/\b(api[_ -]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .slice(0, 500);
}

export function safeOrdonnanceScanError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) {
    return {
      name: error.name || "Error",
      message: redactSecrets(error.message || "Erreur sans message"),
    };
  }
  if (typeof error === "string") {
    return { name: "Error", message: redactSecrets(error) };
  }
  return { name: "UnknownError", message: "Erreur non structurée" };
}

export function logOrdonnanceScanFailure(
  stage: OrdonnanceScanStage,
  error: unknown,
  context: Record<string, string | number | boolean | null> = {},
): void {
  console.error("[ordonnance-scan]", {
    stage,
    ...context,
    error: safeOrdonnanceScanError(error),
  });
}

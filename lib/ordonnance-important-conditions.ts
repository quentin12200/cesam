import type { ConditionImportanteOrdonnance } from "./ordonnance-types.ts";

function sansAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function resumeCourt(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= 120 ? compact : `${compact.slice(0, 117).trimEnd()}…`;
}

function ajouter(
  resultats: ConditionImportanteOrdonnance[],
  condition: Omit<ConditionImportanteOrdonnance, "confidence">,
  confidence = 1,
) {
  const cle = `${condition.type}:${condition.value.toLocaleLowerCase("fr")}`;
  if (resultats.some((item) => `${item.type}:${item.value.toLocaleLowerCase("fr")}` === cle)) return;
  resultats.push({ ...condition, confidence });
}

export function extraireConditionsImportantes(
  sourceTexts: Array<string | null | undefined>,
): ConditionImportanteOrdonnance[] {
  const resultats: ConditionImportanteOrdonnance[] = [];
  for (const sourceTextBrut of sourceTexts) {
    const sourceText = sourceTextBrut?.trim();
    if (!sourceText) continue;
    const source = sansAccents(sourceText).toLowerCase();

    if (/\b(?:utilis(?:able|ation)|administrable)\b[^.;\n]{0,80}\bdes?\s+la\s+naissance\b/.test(source)) {
      ajouter(resultats, { type: "age_minimum", value: "Utilisable dès la naissance", sourceText });
    } else {
      const age = source.match(/\b(?:a\s+partir\s+de|age\s+minimum\s*[:=-]?)\s*(\d+(?:[.,]\d+)?)\s*(jours?|semaines?|mois)\b/);
      if (age) ajouter(resultats, { type: "age_minimum", value: `Âge minimum : ${age[1]} ${age[2]}`, sourceText });
    }

    const velage = sourceText.match(/[^.;\n]{0,100}\b(?:avant|apr[eè]s)\b[^.;\n]{0,80}\bv[eê]lage\b[^.;\n]{0,80}/i);
    if (velage) ajouter(resultats, { type: "velage", value: velage[0].trim(), sourceText });

    if (/\bdose\s+unique\b/.test(source)) {
      ajouter(resultats, { type: "rappel", value: "Dose unique", sourceText });
    } else if (/\b(?:rappel|deuxieme|seconde|2e|2eme)\b/.test(source)) {
      ajouter(resultats, { type: "rappel", value: resumeCourt(sourceText), sourceText });
    }

    const categories = [
      ["Veaux", /\bveaux?\b/],
      ["Bovins", /\bbovins?\b/],
      ["Vaches", /\bvaches?\b/],
      ["Génisses", /\bgenisses?\b/],
    ] as const;
    const categorie = categories.find(([, expression]) => expression.test(source));
    if (categorie && /\b(?:destine|indique|reserve|chez|pour|animaux?)\b/.test(source)) {
      ajouter(resultats, { type: "categorie_animaux", value: `Catégorie : ${categorie[0].toLowerCase()}`, sourceText });
    }

    if (/\brenouvellement\s+interdit\b/.test(source)) {
      ajouter(resultats, { type: "restriction", value: "Renouvellement interdit", sourceText });
    }
    const restriction = sourceText.match(/[^.;\n]{0,100}\b(?:ne\s+pas|interdit|contre-indiqu[eé])\b[^.;\n]{0,120}/i);
    if (restriction && !/\brenouvellement\s+interdit\b/i.test(restriction[0])) {
      ajouter(resultats, { type: "restriction", value: resumeCourt(restriction[0]), sourceText });
    }
  }
  return resultats;
}

export function normaliserConditionsImportantes(
  value: unknown,
  sourceTexts: Array<string | null | undefined>,
): ConditionImportanteOrdonnance[] {
  const structurees = Array.isArray(value) ? value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const type = typeof raw.type === "string" ? raw.type : "restriction";
    const conditionValue = typeof raw.value === "string" ? raw.value.trim() : "";
    const sourceText = typeof raw.sourceText === "string" ? raw.sourceText.trim() : "";
    if (!conditionValue || !sourceText) return [];
    const confidence = typeof raw.confidence === "number"
      ? Math.max(0, Math.min(1, raw.confidence)) : 0;
    return [{ type, value: conditionValue, sourceText, confidence } satisfies ConditionImportanteOrdonnance];
  }) : [];
  const extraites = extraireConditionsImportantes(sourceTexts);
  const resultats: ConditionImportanteOrdonnance[] = [];
  for (const condition of [...extraites, ...structurees]) {
    ajouter(resultats, condition, condition.confidence);
  }
  return resultats;
}

export const TROUPEAU_MOBILE_COLUMNS = ["numero", "sexe", "age", "mother", "father", "group", "reproduction", "dryOff"] as const;
export type TroupeauMobileColumn = typeof TROUPEAU_MOBILE_COLUMNS[number];

export interface TroupeauMobileTablePreferences {
  visible: TroupeauMobileColumn[];
  order: TroupeauMobileColumn[];
}

export const DEFAULT_TROUPEAU_MOBILE_TABLE_PREFERENCES: TroupeauMobileTablePreferences = {
  visible: ["numero", "sexe", "age"],
  order: [...TROUPEAU_MOBILE_COLUMNS],
};

export function parseTroupeauMobileTablePreferences(raw: string | null): TroupeauMobileTablePreferences {
  const defaults = () => ({ visible: [...DEFAULT_TROUPEAU_MOBILE_TABLE_PREFERENCES.visible], order: [...DEFAULT_TROUPEAU_MOBILE_TABLE_PREFERENCES.order] });
  if (!raw) return defaults();
  try {
    const parsed = JSON.parse(raw) as Partial<TroupeauMobileTablePreferences>;
    const visible = Array.isArray(parsed.visible)
      ? parsed.visible.filter((key): key is TroupeauMobileColumn => TROUPEAU_MOBILE_COLUMNS.includes(key as TroupeauMobileColumn))
      : defaults().visible;
    const storedOrder = Array.isArray(parsed.order)
      ? parsed.order.filter((key): key is TroupeauMobileColumn => TROUPEAU_MOBILE_COLUMNS.includes(key as TroupeauMobileColumn))
      : [];
    return { visible: visible.length ? [...new Set(visible)] : ["numero"], order: [...new Set([...storedOrder, ...TROUPEAU_MOBILE_COLUMNS])] };
  } catch {
    return defaults();
  }
}

export function parsePersistentAnimalSelection(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === "string" && id.length > 0))] : [];
  } catch {
    return [];
  }
}

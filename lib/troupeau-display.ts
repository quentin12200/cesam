export function formatFather(name: string | null, number: string | null): string {
  const cleanName = name?.trim() || null;
  const cleanNumber = number?.trim() || null;
  if (cleanName && cleanNumber && cleanName !== cleanNumber) return `${cleanName} · ${cleanNumber}`;
  return cleanName ?? cleanNumber ?? "—";
}

export const MOBILE_DISPLAY_KEYS = ["age", "weight", "category", "mother", "father", "reproduction", "notWeaned", "group"] as const;
export type MobileDisplayKey = typeof MOBILE_DISPLAY_KEYS[number];
export type GestationDisplayMode = "simple" | "duration";
export interface MobileDisplayPreferences { visible: MobileDisplayKey[]; gestation: GestationDisplayMode }

export const DEFAULT_MOBILE_DISPLAY_PREFERENCES: MobileDisplayPreferences = {
  visible: ["age", "category", "mother", "father", "reproduction", "notWeaned"],
  gestation: "duration",
};

export function parseMobileDisplayPreferences(raw: string | null): MobileDisplayPreferences {
  if (!raw) return { ...DEFAULT_MOBILE_DISPLAY_PREFERENCES, visible: [...DEFAULT_MOBILE_DISPLAY_PREFERENCES.visible] };
  try {
    const value = JSON.parse(raw) as Partial<MobileDisplayPreferences>;
    const visible = Array.isArray(value.visible)
      ? value.visible.filter((item): item is MobileDisplayKey => MOBILE_DISPLAY_KEYS.includes(item as MobileDisplayKey))
      : [...DEFAULT_MOBILE_DISPLAY_PREFERENCES.visible];
    return { visible: [...new Set(visible)], gestation: value.gestation === "simple" ? "simple" : "duration" };
  } catch {
    return { ...DEFAULT_MOBILE_DISPLAY_PREFERENCES, visible: [...DEFAULT_MOBILE_DISPLAY_PREFERENCES.visible] };
  }
}

export function serializeMobileDisplayPreferences(value: MobileDisplayPreferences): string {
  return JSON.stringify(value);
}

export function gestationDaysForDisplay(mode: GestationDisplayMode, days: number | null): number | null {
  return mode === "simple" ? null : days;
}

export function shouldDisplayNonWeaned(
  birthDate: string | Date,
  sevreFait: boolean,
  now = new Date()
): boolean {
  if (sevreFait) return false;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return false;
  const firstBirthday = new Date(birth);
  firstBirthday.setFullYear(firstBirthday.getFullYear() + 1);
  return now < firstBirthday;
}

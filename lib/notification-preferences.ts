export const NOTIFICATION_PREFERENCE_KEYS = [
  "morningDigest",
  "imminentCalving",
  "reproductionDelay",
  "echoDue",
  "heatReturn",
  "healthTreatments",
  "prescriptionsStocks",
  "fieldNotes",
] as const;

export type NotificationPreferenceKey = typeof NOTIFICATION_PREFERENCE_KEYS[number];
export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;
export type NotificationPreferencePatch = Partial<NotificationPreferences>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  morningDigest: true,
  imminentCalving: true,
  reproductionDelay: true,
  echoDue: true,
  heatReturn: true,
  healthTreatments: true,
  prescriptionsStocks: true,
  fieldNotes: true,
};

export interface SubscriptionCredentials {
  endpoint: string;
  auth: string;
}

export function isValidSubscriptionCredentials(value: unknown): value is SubscriptionCredentials {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.endpoint === "string"
    && candidate.endpoint.length > 0
    && typeof candidate.auth === "string"
    && candidate.auth.length > 0;
}

export function parseNotificationPreferences(raw: string | null | undefined): NotificationPreferences {
  if (!raw) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  try {
    const saved = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(
      NOTIFICATION_PREFERENCE_KEYS.map((key) => [
        key,
        typeof saved[key] === "boolean" ? saved[key] : true,
      ])
    ) as NotificationPreferences;
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

export function validateNotificationPreferencePatch(value: unknown):
  | { valid: true; patch: NotificationPreferencePatch }
  | { valid: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { valid: false, error: "Les préférences doivent être un objet JSON." };
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) {
    return { valid: false, error: "Aucune préférence à enregistrer." };
  }

  const allowed = new Set<string>(NOTIFICATION_PREFERENCE_KEYS);
  for (const [key, setting] of entries) {
    if (!allowed.has(key)) {
      return { valid: false, error: `Préférence inconnue : ${key}.` };
    }
    if (typeof setting !== "boolean") {
      return { valid: false, error: `La préférence ${key} doit être un booléen.` };
    }
  }

  return { valid: true, patch: Object.fromEntries(entries) as NotificationPreferencePatch };
}

export function mergeNotificationPreferences(
  currentRaw: string | null | undefined,
  patch: NotificationPreferencePatch
) {
  return {
    ...parseNotificationPreferences(currentRaw),
    ...patch,
  };
}

export interface DailyNotificationGroups {
  general: string[];
  imminentCalving: string[];
  reproductionDelay: string[];
  echoDue: string[];
  healthTreatments: string[];
  prescriptionsStocks: string[];
}

export function selectDailyNotificationItems(
  groups: DailyNotificationGroups,
  preferences: NotificationPreferences
) {
  return [
    ...(preferences.morningDigest ? groups.general : []),
    ...(preferences.imminentCalving ? groups.imminentCalving : []),
    ...(preferences.reproductionDelay ? groups.reproductionDelay : []),
    ...(preferences.echoDue ? groups.echoDue : []),
    ...(preferences.healthTreatments ? groups.healthTreatments : []),
    ...(preferences.prescriptionsStocks ? groups.prescriptionsStocks : []),
  ];
}

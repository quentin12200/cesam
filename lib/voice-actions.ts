import type { PatteParage } from "@/lib/parage";
import type { VoiceTarget } from "@/lib/voice-sanitary";

export type VoiceActionId = "sanitaire" | "parage";

export interface VoiceActionDefinition {
  id: VoiceActionId;
  label: string;
  href: string;
}

export const VOICE_ACTIONS: VoiceActionDefinition[] = [
  { id: "sanitaire", label: "Créer un événement sanitaire", href: "/sanitaire/nouvel-evenement?brouillonVocal=1" },
  { id: "parage", label: "Ouvrir Parage", href: "/parage?brouillonVocal=1" },
];

export const VOICE_PARAGE_STORAGE_KEY = "cesam:brouillon-vocal-parage";

export interface VoiceParageDraft {
  transcript: string;
  target: VoiceTarget;
  date: string;
  pattes: PatteParage[];
  note: string;
}

export function getVoiceAction(id: VoiceActionId) {
  return VOICE_ACTIONS.find((action) => action.id === id);
}

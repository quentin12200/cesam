import type { PatteParage } from "@/lib/parage";
import type { VoiceTarget } from "@/lib/voice-sanitary";

export type VoiceActionId = "sanitaire" | "parage" | "saillie";

export interface VoiceActionDefinition {
  id: VoiceActionId;
  label: string;
  continueLabel: string;
  href: string;
}

export const VOICE_ACTIONS: VoiceActionDefinition[] = [
  { id: "sanitaire", label: "Nouvel événement sanitaire", continueLabel: "Continuer vers Sanitaire", href: "/sanitaire/nouvel-evenement?brouillonVocal=1" },
  { id: "parage", label: "Parage", continueLabel: "Continuer vers Parage", href: "/parage?brouillonVocal=1" },
  { id: "saillie", label: "Saillie / IA", continueLabel: "Continuer vers Reproduction", href: "/reproduction?brouillonVocal=1" },
];

export const VOICE_PARAGE_STORAGE_KEY = "cesam:brouillon-vocal-parage";
export const VOICE_REPRODUCTION_STORAGE_KEY = "cesam:brouillon-vocal-reproduction";

export interface VoiceParageDraft {
  transcript: string;
  target: VoiceTarget;
  date: string;
  pattes: PatteParage[];
  note: string;
}

export interface VoiceReproductionDraft {
  transcript: string;
  target: VoiceTarget;
  date: string;
  moment: "Matin" | "Soir" | null;
  type: "NATURELLE" | "IA";
  taureau: { id: string; nom: string; present: boolean } | null;
}

export function getVoiceAction(id: VoiceActionId) {
  return VOICE_ACTIONS.find((action) => action.id === id);
}

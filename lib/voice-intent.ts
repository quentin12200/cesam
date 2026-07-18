import { normalizeSearch } from "./fuzzy-search";
import { distanceEdition, phonetiserMot } from "./voice-sanitary";
import type { VoiceActionId } from "./voice-actions";

export interface VoiceIntentContext {
  texte: string;
  cibleTrouvee: boolean;
  cibleFemelle: boolean;
  taureauTrouve: boolean;
  medicamentTrouve: boolean;
  medicamentIncertain: boolean;
  evenementTrouve: boolean;
  poidsTrouve: boolean;
  temperatureTrouvee: boolean;
  sexeTrouve: boolean;
  pattesTrouvees: boolean;
  traitementMentionne: boolean;
  ajouterAuParage: boolean;
  actionApprise: VoiceActionId | null;
}

export interface VoiceIntentAnalysis {
  actions: VoiceActionId[];
  scores: Record<VoiceActionId, number>;
}

const CUES: Record<VoiceActionId, string[]> = {
  velage: ["velage", "a vele", "a fait son veau", "a eu un veau", "vient de veler", "en train de veler", "naissance"],
  saillie: ["saillie", "insemination", "avec le taureau", "a fait l ia"],
  chaleur: ["chaleur", "en chaleur", "retour en chaleur"],
  pesee: ["peser", "pesee", "poids", "pese kilos"],
  parage: ["parage", "parer", "boiterie", "patte"],
  sanitaire: ["traitement", "soigner", "malade", "symptome", "vaccin"],
};

function scorePhonetique(texte: string, indice: string): number {
  const phrase = normalizeSearch(texte);
  const attendu = normalizeSearch(indice);
  if (` ${phrase} `.includes(` ${attendu} `)) return 4;

  const mots = phrase.split(/\s+/).filter(Boolean);
  const taille = attendu.split(/\s+/).length;
  const attenduPhonetique = phonetiserMot(attendu);
  let meilleurRatio = Number.POSITIVE_INFINITY;
  for (let debut = 0; debut < mots.length; debut++) {
    for (let longueur = Math.max(1, taille - 1); longueur <= taille + 1 && debut + longueur <= mots.length; longueur++) {
      const segment = mots.slice(debut, debut + longueur).join(" ");
      const segmentPhonetique = phonetiserMot(segment);
      if (!segmentPhonetique || !attenduPhonetique) continue;
      meilleurRatio = Math.min(
        meilleurRatio,
        distanceEdition(segmentPhonetique, attenduPhonetique) / Math.max(segmentPhonetique.length, attenduPhonetique.length),
      );
    }
  }
  if (meilleurRatio <= 0.24) return 3;
  if (meilleurRatio <= 0.42) return 2;
  return 0;
}

function meilleurIndice(texte: string, action: VoiceActionId): number {
  return Math.max(...CUES[action].map((indice) => scorePhonetique(texte, indice)));
}

export function interpreterSexeVeau(texte: string, contexteVelage: boolean): "M" | "F" | null {
  if (!contexteVelage) return null;
  const scoreMale = Math.max(scorePhonetique(texte, "male"), scorePhonetique(texte, "un male"));
  const scoreFemelle = Math.max(scorePhonetique(texte, "femelle"), scorePhonetique(texte, "une femelle"));
  if (scoreMale < 2 && scoreFemelle < 2) return null;
  if (Math.abs(scoreMale - scoreFemelle) < 1) return null;
  return scoreMale > scoreFemelle ? "M" : "F";
}

export function analyserIntentionsVocales(contexte: VoiceIntentContext): VoiceIntentAnalysis {
  const scores: Record<VoiceActionId, number> = {
    sanitaire: 0,
    parage: 0,
    saillie: 0,
    chaleur: 0,
    pesee: 0,
    velage: 0,
  };
  const cible = contexte.cibleTrouvee ? 1 : 0;

  scores.velage = contexte.cibleFemelle ? meilleurIndice(contexte.texte, "velage") + cible + 1 + (contexte.sexeTrouve ? 1 : 0) : 0;
  scores.saillie = contexte.cibleFemelle ? meilleurIndice(contexte.texte, "saillie") + cible + (contexte.taureauTrouve ? 5 : 0) : 0;
  scores.chaleur = contexte.cibleFemelle ? meilleurIndice(contexte.texte, "chaleur") + cible + 1 : 0;
  scores.pesee = meilleurIndice(contexte.texte, "pesee") + cible + (contexte.poidsTrouve ? 2 : 0);
  scores.parage = meilleurIndice(contexte.texte, "parage") + cible + (contexte.pattesTrouvees ? 2 : 0) + (contexte.ajouterAuParage ? 2 : 0);
  scores.sanitaire = meilleurIndice(contexte.texte, "sanitaire") + cible
    + (contexte.evenementTrouve ? 3 : 0)
    + (contexte.medicamentTrouve ? 4 : 0)
    + (contexte.medicamentIncertain ? 2 : 0)
    + (contexte.temperatureTrouvee ? 3 : 0)
    + (contexte.traitementMentionne ? 2 : 0);

  if (contexte.actionApprise) scores[contexte.actionApprise] += 5;

  const classees = (Object.entries(scores) as Array<[VoiceActionId, number]>)
    .filter(([, score]) => score >= 4)
    .sort((a, b) => b[1] - a[1]);
  if (classees.length === 0) return { actions: [], scores };
  if (classees.length === 1 || classees[0][1] >= classees[1][1] + 2) {
    return { actions: [classees[0][0]], scores };
  }
  return { actions: classees.filter(([, score]) => score >= classees[0][1] - 1).slice(0, 3).map(([action]) => action), scores };
}

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Mic, MicOff, Pencil, X } from "lucide-react";
import SelectionModal from "@/components/SelectionModal";
import {
  VOICE_SANITARY_STORAGE_KEY,
  type VoiceAnalysisResponse,
  type VoiceSanitaryDraft,
} from "@/lib/voice-sanitary";
import {
  VOICE_ACTIONS,
  VOICE_PARAGE_STORAGE_KEY,
  getVoiceAction,
  type VoiceActionId,
  type VoiceParageDraft,
} from "@/lib/voice-actions";

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onspeechend: (() => void) | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

type Status = "idle" | "listening" | "analysing" | "note" | "error";

const SILENCE_TIMEOUT_MS = 30000;

function ResumeBrouillon({ draft }: { draft: VoiceSanitaryDraft }) {
  const details = [
    draft.event?.nom,
    draft.temperature !== null ? `${draft.temperature.toFixed(1).replace(".", ",")} °C` : null,
    draft.pattes.length > 0 ? draft.pattes.join(", ") : null,
    draft.medicament?.nom,
    !draft.medicament && draft.medicamentCandidates.length > 0 && draft.medicamentEntendu ? `Médicament « ${draft.medicamentEntendu} » à confirmer` : null,
    draft.voieAdministration ? `Voie ${draft.voieAdministration}` : null,
    draft.ajouterAuParage ? "Ajouter au parage" : null,
    draft.rappelDemande ? "Rappel / surveillance demandé" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3 p-4">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm italic text-amber-900">« {draft.transcript} »</p>
      <dl className="space-y-2 text-sm">
        <div className="flex gap-3"><dt className="w-20 shrink-0 text-gray-500">Animal</dt><dd className="font-semibold text-gray-900">{draft.target?.label ?? "À confirmer"}</dd></div>
        <div className="flex gap-3"><dt className="w-20 shrink-0 text-gray-500">Quand</dt><dd>{draft.date} · {draft.moment.toLowerCase()}</dd></div>
        <div className="flex gap-3"><dt className="w-20 shrink-0 text-gray-500">Détecté</dt><dd>{details.length > 0 ? details.join(" · ") : "Aucune information sanitaire sûre"}</dd></div>
      </dl>
      <p className="text-xs text-gray-500">Rien ne sera enregistré avant la validation finale dans le formulaire choisi.</p>
    </div>
  );
}

export default function VoiceButton() {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<Exclude<VoiceAnalysisResponse, { outcome: "note" }> | null>(null);
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [chosenAction, setChosenAction] = useState<VoiceActionId | null>(null);
  const [showAllActions, setShowAllActions] = useState(false);
  const [learningError, setLearningError] = useState("");
  const recRef = useRef<SpeechRecognition | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window));
  }, []);

  function clearSilenceTimer() {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = null;
  }

  function clearHideTimer() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = null;
  }

  function clearAfter(ms: number) {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      setTranscript(null);
      setMessage("");
      setStatus("idle");
    }, ms);
  }

  async function saveNote(text: string, reason: string) {
    try {
      const response = await fetch("/api/notes-terrain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte: text }),
      });
      if (!response.ok) throw new Error();
      setStatus("note");
      setMessage(reason);
      clearAfter(6000);
    } catch {
      setStatus("error");
      setMessage("Impossible de conserver la note vocale");
      clearAfter(6000);
    }
  }

  async function analysePhrase(text: string) {
    setAnalysis(null);
    setEditing(false);
    setChosenAction(null);
    setShowAllActions(false);
    setLearningError("");
    setTranscript(text);
    setStatus("analysing");
    setMessage("");
    try {
      const response = await fetch("/api/notes-terrain/analyser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte: text }),
      });
      if (!response.ok) throw new Error();
      const resultat = await response.json() as VoiceAnalysisResponse;
      if (resultat.outcome === "note") {
        await saveNote(text, resultat.reason);
        return;
      }
      setAnalysis(resultat);
      setChosenAction(resultat.draft.suggestedActions.length === 1 ? resultat.draft.suggestedActions[0] : null);
      setEditedText(text);
      setEditing(false);
      setStatus("idle");
    } catch {
      await saveNote(text, "Analyse impossible : note vocale conservée");
    }
  }

  function stopRec() {
    clearSilenceTimer();
    try { recRef.current?.stop(); } catch {}
  }

  function toggle() {
    if (status === "listening") {
      stopRec();
      return;
    }
    if (!supported || status === "analysing") return;

    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    handledRef.current = false;

    const armSilenceTimer = () => {
      clearSilenceTimer();
      silenceTimer.current = setTimeout(stopRec, SILENCE_TIMEOUT_MS);
    };
    armSilenceTimer();

    rec.onresult = (event) => {
      if (handledRef.current) return;
      handledRef.current = true;
      clearSilenceTimer();
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) text += event.results[i][0].transcript;
      text = text.trim();
      if (text) void analysePhrase(text);
    };
    rec.onspeechend = armSilenceTimer;
    rec.onend = () => {
      clearSilenceTimer();
      setStatus((current) => current === "listening" ? "idle" : current);
    };
    rec.onerror = (event) => {
      clearSilenceTimer();
      setStatus("error");
      setMessage(event.error === "not-allowed" ? "Permission micro refusée" : event.error === "network" ? "Erreur réseau" : "Micro non disponible");
      clearAfter(5000);
    };

    recRef.current = rec;
    try {
      rec.start();
      setStatus("listening");
      setTranscript(null);
      setMessage("");
      clearHideTimer();
    } catch {
      setStatus("error");
      setMessage("Impossible de démarrer le micro");
      clearAfter(4000);
    }
  }

  function choisirAnimal(nutrav: string, nom: string | null) {
    if (!analysis) return;
    const draft = {
      ...analysis.draft,
      target: { kind: "animal" as const, label: `${nutrav}${nom ? ` · ${nom}` : ""}`, nutravs: [nutrav] },
    };
    setAnalysis({
      outcome: draft.suggestedActions.length > 1 ? "choose_action" : "draft",
      draft,
    });
    setChosenAction(draft.suggestedActions.length === 1 ? draft.suggestedActions[0] : null);
  }

  async function choisirMedicament(id: string, nom: string) {
    if (!analysis) return;
    const transcription = analysis.draft.medicamentEntendu;
    setAnalysis({
      ...analysis,
      draft: {
        ...analysis.draft,
        medicament: { id, nom },
        medicamentCandidates: [],
        traitementMentionne: true,
        voieAdministration: analysis.draft.voieAdministration ?? (/intra\s*nasal/i.test(nom) ? "NASALE" : null),
      },
    });
    if (!transcription) return;
    try {
      const response = await fetch("/api/medicaments/alias-vocal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcription, medicamentId: id }),
      });
      if (!response.ok) throw new Error();
      setLearningError("");
    } catch {
      setLearningError("Le médicament est sélectionné, mais la correction n’a pas pu être mémorisée.");
    }
  }

  function ouvrirFormulaire() {
    if (!analysis?.draft.target || !chosenAction) return;
    const action = getVoiceAction(chosenAction);
    if (!action) return;
    if (chosenAction === "parage") {
      const draftParage: VoiceParageDraft = {
        transcript: analysis.draft.transcript,
        target: analysis.draft.target,
        date: analysis.draft.date,
        pattes: analysis.draft.pattes,
        note: analysis.draft.description,
      };
      sessionStorage.setItem(VOICE_PARAGE_STORAGE_KEY, JSON.stringify(draftParage));
    } else {
      sessionStorage.setItem(VOICE_SANITARY_STORAGE_KEY, JSON.stringify(analysis.draft));
    }
    setAnalysis(null);
    router.push(action.href);
  }

  function dismiss() {
    clearHideTimer();
    setTranscript(null);
    setMessage("");
    setStatus("idle");
  }

  if (!supported) return null;
  const isListening = status === "listening";

  return (
    <>
      {(isListening || status === "analysing" || status === "note" || status === "error") && (
        <div className="fixed right-3 top-14 z-40 max-w-[290px] rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2.5 text-sm shadow-lg backdrop-blur-sm">
          {isListening && <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Parle… arrêt automatique dans 30 s</span>}
          {status === "analysing" && <span className="text-xs font-medium text-amber-700">Analyse de la phrase…</span>}
          {(status === "note" || status === "error") && (
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><p className="line-clamp-2 italic text-amber-900">« {transcript} »</p><p className={`mt-1 text-xs font-semibold ${status === "error" ? "text-red-600" : "text-green-700"}`}>{message}</p></div>
              <button type="button" onClick={dismiss} className="shrink-0 rounded p-1 text-amber-500" aria-label="Fermer"><X size={15} /></button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={status === "analysing"}
        aria-label={isListening ? "Arrêter l’enregistrement" : "Dicter une note ou un événement sanitaire"}
        title={isListening ? "Appuie pour arrêter" : "Dicter une note ou un événement sanitaire"}
        className={`rounded-lg p-1.5 text-white transition-colors touch-manipulation disabled:opacity-60 ${isListening ? "animate-pulse bg-red-500" : status === "note" ? "bg-green-600" : "bg-amber-500 hover:bg-amber-400"}`}
      >
        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
      </button>

      {analysis && (
        <SelectionModal
          title="Action détectée — à vérifier"
          maxWidth="md"
          onClose={() => setAnalysis(null)}
          footer={(
            <div className="flex items-center justify-end gap-2 p-3">
              <button type="button" onClick={() => setEditing(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700"><Pencil size={16} /> Modifier</button>
              <button type="button" disabled={!analysis.draft.target || !chosenAction || analysis.draft.medicamentCandidates.length > 0} onClick={ouvrirFormulaire} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white disabled:opacity-40"><Check size={17} /> Continuer</button>
            </div>
          )}
        >
          {editing ? (
            <div className="space-y-3 p-4">
              <label className="block text-sm font-medium text-gray-700">Corriger la phrase</label>
              <textarea value={editedText} onChange={(event) => setEditedText(event.target.value)} rows={4} className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm" autoFocus />
              <button type="button" onClick={() => void analysePhrase(editedText.trim())} disabled={!editedText.trim()} className="min-h-11 w-full rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-40">Analyser à nouveau</button>
            </div>
          ) : (
            <>
              <ResumeBrouillon draft={analysis.draft} />
              {!analysis.draft.medicament && analysis.draft.medicamentCandidates.length > 0 && (
                <div className="border-t border-gray-100 p-4">
                  <p className="mb-1 text-sm font-semibold text-gray-800">Quel médicament voulais-tu dire ?</p>
                  {analysis.draft.medicamentEntendu && <p className="mb-2 text-xs text-gray-500">Le téléphone a écrit « {analysis.draft.medicamentEntendu} ».</p>}
                  <div className="grid gap-2">
                    {analysis.draft.medicamentCandidates.map((candidate) => (
                      <button key={candidate.id} type="button" onClick={() => void choisirMedicament(candidate.id, candidate.nom)} className="min-h-11 rounded-lg border border-gray-200 px-3 text-left text-sm font-semibold text-gray-800 hover:border-blue-400 hover:bg-blue-50">
                        {candidate.nom}
                      </button>
                    ))}
                  </div>
                  {learningError && <p className="mt-2 text-xs text-orange-700">{learningError}</p>}
                </div>
              )}
              {analysis.outcome === "choose_action" && (
                <div className="border-t border-gray-100 p-4">
                  <p className="mb-2 text-sm font-semibold text-gray-800">Que veux-tu ouvrir ?</p>
                  <div className="grid gap-2">
                    {(showAllActions ? VOICE_ACTIONS : VOICE_ACTIONS.filter((action) => analysis.draft.suggestedActions.includes(action.id))).map((action) => (
                      <button key={action.id} type="button" onClick={() => setChosenAction(action.id)} className={`min-h-11 rounded-lg border px-3 text-left text-sm font-semibold ${chosenAction === action.id ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 text-gray-700 hover:border-green-400"}`}>
                        {action.label}
                      </button>
                    ))}
                  </div>
                  {!showAllActions && <button type="button" onClick={() => setShowAllActions(true)} className="mt-2 min-h-10 text-sm font-medium text-gray-500">Autre action…</button>}
                </div>
              )}
              {analysis.outcome === "confirm_animal" && (
                <div className="border-t border-gray-100 p-4">
                  <p className="mb-2 text-sm font-semibold text-gray-800">Quel animal voulais-tu indiquer ?</p>
                  <div className="grid gap-2">
                    {analysis.candidates.map((candidate) => (
                      <button key={candidate.nutrav} type="button" onClick={() => choisirAnimal(candidate.nutrav, candidate.nom)} className="min-h-11 rounded-lg border border-gray-200 px-3 text-left text-sm hover:border-green-400 hover:bg-green-50">
                        <span className="font-bold text-green-800">{candidate.nutrav}</span>{candidate.nom ? ` · ${candidate.nom}` : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </SelectionModal>
      )}
    </>
  );
}

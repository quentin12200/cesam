"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, RotateCcw, Search, Stethoscope, X } from "lucide-react";
import SelectionModal from "@/components/SelectionModal";
import { normalizeSearch, searchTypesEvenement } from "@/lib/fuzzy-search";
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
import { useOriginNavigation } from "@/lib/use-origin-navigation";
import { useReproductionModal } from "@/app/components/ReproductionModalProvider";

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

type Status = "idle" | "listening" | "analysing" | "error";

const SILENCE_TIMEOUT_MS = 30000;

interface AnimalOption {
  id: string;
  nutrav: string;
  nobovi: string | null;
}

interface MedicamentOption {
  id: string;
  nom: string;
  dci: string | null;
  actif: boolean;
}

interface TaureauOption {
  id: string;
  nupere: string;
  nopere: string | null;
  present: boolean;
}

export default function VoiceButton() {
  const router = useRouter();
  const { hrefWithOrigin } = useOriginNavigation();
  const { openReproductionModal } = useReproductionModal();
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<Exclude<VoiceAnalysisResponse, { outcome: "note" }> | null>(null);
  const [chosenAction, setChosenAction] = useState<VoiceActionId | null>(null);
  const [showAllActions, setShowAllActions] = useState(false);
  const [learningError, setLearningError] = useState("");
  const [animalPickerOpen, setAnimalPickerOpen] = useState(false);
  const [animalQuery, setAnimalQuery] = useState("");
  const [animaux, setAnimaux] = useState<AnimalOption[]>([]);
  const [medicamentPickerOpen, setMedicamentPickerOpen] = useState(false);
  const [medicamentQuery, setMedicamentQuery] = useState("");
  const [medicaments, setMedicaments] = useState<MedicamentOption[]>([]);
  const [taureauPickerOpen, setTaureauPickerOpen] = useState(false);
  const [taureauQuery, setTaureauQuery] = useState("");
  const [taureaux, setTaureaux] = useState<TaureauOption[]>([]);
  const recRef = useRef<SpeechRecognition | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledRef = useRef(false);
  const analysisOuverte = analysis !== null;

  useEffect(() => {
    setSupported(typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window));
  }, []);

  useEffect(() => {
    if (!analysisOuverte) return;
    fetch("/api/animaux/picker")
      .then((response) => response.json())
      .then(setAnimaux)
      .catch(() => {});
  }, [analysisOuverte]);

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

  async function analysePhrase(text: string) {
    setAnalysis(null);
    setChosenAction(null);
    setShowAllActions(false);
    setLearningError("");
    setAnimalPickerOpen(false);
    setMedicamentPickerOpen(false);
    setTaureauPickerOpen(false);
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
        setStatus("error");
        setMessage("Action non reconnue. Utilise le micro orange pour conserver une note libre.");
        clearAfter(6500);
        return;
      }
      setAnalysis(resultat);
      setChosenAction(resultat.draft.suggestedActions.length === 1 ? resultat.draft.suggestedActions[0] : null);
      setStatus("idle");
    } catch {
      setStatus("error");
      setMessage("Analyse impossible. Rien n’a été enregistré.");
      clearAfter(5000);
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
    const nutravs = [...new Set([...(analysis.draft.target?.nutravs ?? []), nutrav])];
    const labels = nutravs.map((numero) => {
      const animal = animaux.find((item) => item.nutrav === numero);
      if (animal) return `${animal.nutrav}${animal.nobovi ? ` · ${animal.nobovi}` : ""}`;
      return numero === nutrav ? `${nutrav}${nom ? ` · ${nom}` : ""}` : numero;
    });
    const draft = {
      ...analysis.draft,
      target: { kind: "animal" as const, label: labels.join(", "), nutravs },
    };
    setAnalysis({
      outcome: draft.suggestedActions.length > 1 ? "choose_action" : "draft",
      draft,
    });
    setChosenAction(draft.suggestedActions.length === 1 ? draft.suggestedActions[0] : null);
  }

  function mettreAJourDraft(modifications: Partial<VoiceSanitaryDraft>) {
    setAnalysis((actuelle) => actuelle ? { ...actuelle, draft: { ...actuelle.draft, ...modifications } } : actuelle);
  }

  function retirerAnimal(nutrav: string) {
    if (!analysis?.draft.target) return;
    const nutravs = analysis.draft.target.nutravs.filter((numero) => numero !== nutrav);
    const labels = nutravs.map((numero) => {
      const animal = animaux.find((item) => item.nutrav === numero);
      return animal ? `${animal.nutrav}${animal.nobovi ? ` · ${animal.nobovi}` : ""}` : numero;
    });
    mettreAJourDraft({
      target: nutravs.length > 0 ? { kind: "animal", label: labels.join(", "), nutravs } : null,
    });
  }

  async function ouvrirRechercheMedicaments() {
    setMedicamentPickerOpen(true);
    setMedicamentQuery(analysis?.draft.medicamentEntendu ?? "");
    if (medicaments.length > 0) return;
    try {
      const response = await fetch("/api/medicaments");
      const liste = await response.json() as MedicamentOption[];
      setMedicaments(liste.filter((medicament) => medicament.actif));
    } catch {
      setLearningError("La liste des médicaments n’a pas pu être chargée.");
    }
  }

  function medicamentIntrouvable() {
    mettreAJourDraft({ medicament: null, medicamentCandidates: [], traitementMentionne: false });
    setMedicamentPickerOpen(false);
    setLearningError("Médicament introuvable : tu pourras le rechercher à nouveau dans le formulaire sanitaire.");
  }

  async function ouvrirRechercheTaureaux() {
    setTaureauPickerOpen(true);
    setTaureauQuery(analysis?.draft.taureau?.nom ?? "");
    if (taureaux.length > 0) return;
    try {
      const response = await fetch("/api/taureaux");
      const resultat = await response.json() as { taureaux: TaureauOption[] };
      setTaureaux(resultat.taureaux);
    } catch {
      setLearningError("La liste des taureaux n’a pas pu être chargée.");
    }
  }

  function choisirTaureau(taureau: TaureauOption) {
    mettreAJourDraft({
      taureau: {
        id: taureau.id,
        nom: taureau.nopere ?? taureau.nupere,
        present: taureau.present,
      },
      reproductionType: taureau.present ? "NATURELLE" : "IA",
    });
    setTaureauPickerOpen(false);
    setTaureauQuery("");
  }

  function relancerDictee() {
    setAnalysis(null);
    setTimeout(() => toggle(), 0);
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
    setMedicamentPickerOpen(false);
    setMedicamentQuery("");
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

  async function ouvrirFormulaire() {
    if (!analysis?.draft.target || !chosenAction) return;
    const action = getVoiceAction(chosenAction);
    if (!action) return;
    if (!analysis.draft.suggestedActions.includes(chosenAction)) {
      try {
        await fetch("/api/voice-routing-alias", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phrase: analysis.draft.transcript, action: chosenAction }),
        });
      } catch {}
    }
    if (chosenAction === "chaleur") {
      const selectedAnimals = analysis.draft.target.nutravs
        .map((nutrav) => animaux.find((animal) => animal.nutrav === nutrav))
        .filter((animal): animal is AnimalOption => Boolean(animal))
        .map((animal) => ({ id: animal.id, nutrav: animal.nutrav, nom: animal.nobovi }));
      setAnalysis(null);
      openReproductionModal({ action: "chaleur", animals: selectedAnimals });
      return;
    }
    if (chosenAction === "saillie") {
      const selectedAnimals = analysis.draft.target.nutravs
        .map((nutrav) => animaux.find((animal) => animal.nutrav === nutrav))
        .filter((animal): animal is AnimalOption => Boolean(animal))
        .map((animal) => ({ id: animal.id, nutrav: animal.nutrav, nom: animal.nobovi }));
      const recognizedBull = analysis.draft.taureau;
      setAnalysis(null);
      openReproductionModal({
        action: "saillie",
        animals: selectedAnimals,
        date: analysis.draft.date || undefined,
        type: analysis.draft.reproductionType ?? "NATURELLE",
        initialBull: recognizedBull ? {
          id: recognizedBull.id,
          reference: recognizedBull.nom,
          nom: recognizedBull.nom,
        } : null,
      });
      return;
    }
    if (chosenAction === "pesee") {
      const nutrav = analysis.draft.target.nutravs[0];
      const poids = analysis.draft.poids === null ? "" : `&poids=${encodeURIComponent(String(analysis.draft.poids))}`;
      setAnalysis(null);
      router.push(hrefWithOrigin(`/troupeau/${encodeURIComponent(nutrav)}?onglet=identite&pesee=1${poids}`));
      return;
    }
    if (chosenAction === "velage") {
      const nutrav = analysis.draft.target.nutravs[0];
      const params = new URLSearchParams({ nouveau: "1", mere: nutrav });
      if (analysis.draft.dateMentionnee && analysis.draft.date) params.set("date", analysis.draft.date);
      if (analysis.draft.momentMentionne && analysis.draft.moment) params.set("moment", analysis.draft.moment);
      if (analysis.draft.veauSexe) params.set("sexe", analysis.draft.veauSexe);
      setAnalysis(null);
      router.push(hrefWithOrigin(`/velage?${params.toString()}`));
      return;
    }
    if (chosenAction === "parage") {
      const draftParage: VoiceParageDraft = {
        transcript: analysis.draft.transcript,
        target: analysis.draft.target,
        date: analysis.draft.date ?? "",
        pattes: analysis.draft.pattes,
        note: analysis.draft.description,
      };
      sessionStorage.setItem(VOICE_PARAGE_STORAGE_KEY, JSON.stringify(draftParage));
    } else {
      sessionStorage.setItem(VOICE_SANITARY_STORAGE_KEY, JSON.stringify(analysis.draft));
    }
    setAnalysis(null);
    router.push(hrefWithOrigin(action.href));
  }

  function dismiss() {
    clearHideTimer();
    setTranscript(null);
    setMessage("");
    setStatus("idle");
  }

  if (!supported) return null;
  const isListening = status === "listening";
  const selectedAction = chosenAction ? getVoiceAction(chosenAction) : null;
  const selectedNutravs = analysis?.draft.target?.nutravs ?? [];
  const selectedAnimaux = selectedNutravs.map((nutrav) => {
    const animal = animaux.find((item) => item.nutrav === nutrav);
    return { nutrav, nom: animal?.nobovi ?? null };
  });
  const animauxFiltres = animaux.filter((animal) => {
    const recherche = normalizeSearch(animalQuery);
    return !recherche || normalizeSearch(`${animal.nutrav} ${animal.nobovi ?? ""}`).includes(recherche);
  }).slice(0, 20);
  const medicamentsRecherchables = medicaments.map((medicament) => ({
    ...medicament,
    synonymes: medicament.dci,
  }));
  const medicamentsFiltres = medicamentQuery.trim()
    ? searchTypesEvenement(medicamentQuery, medicamentsRecherchables).slice(0, 20).map((resultat) => resultat.item)
    : medicamentsRecherchables;
  const taureauxRecherchables = taureaux.map((taureau) => ({
    ...taureau,
    nom: taureau.nopere ?? taureau.nupere,
    synonymes: taureau.nupere,
  }));
  const taureauxFiltres = taureauQuery.trim()
    ? searchTypesEvenement(taureauQuery, taureauxRecherchables).slice(0, 20).map((resultat) => resultat.item)
    : taureauxRecherchables;
  const parageAvecPlusieursAnimaux = chosenAction === "parage" && selectedNutravs.length !== 1;
  const peseeAvecPlusieursAnimaux = chosenAction === "pesee" && selectedNutravs.length !== 1;
  const velageAvecPlusieursAnimaux = chosenAction === "velage" && selectedNutravs.length !== 1;
  const informationsReconnues = analysis ? [
    chosenAction === "sanitaire" ? analysis.draft.event?.nom ?? null : null,
    analysis.draft.dateMentionnee && analysis.draft.date
      ? new Date(`${analysis.draft.date}T12:00:00`).toLocaleDateString("fr-FR")
      : null,
    analysis.draft.momentMentionne ? analysis.draft.moment : null,
    analysis.draft.temperature !== null ? `${String(analysis.draft.temperature).replace(".", ",")} °C` : null,
    chosenAction === "pesee" && analysis.draft.poids !== null ? `${String(analysis.draft.poids).replace(".", ",")} kg` : null,
    ...analysis.draft.pattes,
    chosenAction === "sanitaire" ? analysis.draft.medicament?.nom ?? null : null,
    chosenAction === "sanitaire" && analysis.draft.voieAdministration ? `Voie ${analysis.draft.voieAdministration}` : null,
    analysis.draft.ajouterAuParage ? "Ajouter au parage" : null,
    analysis.draft.rappelDemande ? "Rappel demandé" : null,
  ].filter((information): information is string => Boolean(information)) : [];
  const medicamentAEteEntendu = Boolean(
    analysis?.draft.medicament
    || analysis?.draft.medicamentEntendu
    || analysis?.draft.medicamentCandidates.length,
  );

  return (
    <>
      {(isListening || status === "analysing" || status === "error") && (
        <div className="fixed right-3 top-14 z-40 max-w-[290px] rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2.5 text-sm shadow-lg backdrop-blur-sm">
          {isListening && <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Parle… arrêt automatique dans 30 s</span>}
          {status === "analysing" && <span className="text-xs font-medium text-amber-700">Analyse de la phrase…</span>}
          {status === "error" && (
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1"><p className="line-clamp-2 italic text-amber-900">« {transcript} »</p><p className="mt-1 text-xs font-semibold text-red-600">{message}</p></div>
              <button type="button" onClick={dismiss} className="shrink-0 rounded p-1 text-amber-500" aria-label="Fermer"><X size={15} /></button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={toggle}
        disabled={status === "analysing"}
        aria-label={isListening ? "Arrêter la dictée" : "Dicter une action ou un événement"}
        title={isListening ? "Appuie pour arrêter" : "Dicter une action ou un événement"}
        className={`rounded-xl p-2.5 text-white shadow-sm ring-1 ring-white/20 transition-colors touch-manipulation disabled:opacity-60 ${isListening ? "animate-pulse bg-red-500" : "bg-green-600 hover:bg-green-500"}`}
      >
        <Stethoscope size={23} />
      </button>

      {analysis && (
        <SelectionModal
          title="Dictée détectée — à vérifier"
          maxWidth="md"
          onClose={() => setAnalysis(null)}
          footer={(
            <div className="p-3">
              {parageAvecPlusieursAnimaux && <p className="mb-2 text-xs font-medium text-orange-700">Le parage accepte un seul animal. Retire les autres ou choisis Sanitaire.</p>}
              {peseeAvecPlusieursAnimaux && <p className="mb-2 text-xs font-medium text-orange-700">La pesée accepte un seul animal.</p>}
              {velageAvecPlusieursAnimaux && <p className="mb-2 text-xs font-medium text-orange-700">Le vêlage accepte une seule mère.</p>}
              <button type="button" disabled={!analysis.draft.target || !selectedAction || parageAvecPlusieursAnimaux || peseeAvecPlusieursAnimaux || velageAvecPlusieursAnimaux} onClick={() => void ouvrirFormulaire()} className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white disabled:opacity-40">
                <Check size={17} /> {selectedAction?.continueLabel ?? "Choisir une destination"}
              </button>
            </div>
          )}
        >
          <div className="divide-y divide-gray-100">
            <section className="p-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase text-gray-400">Phrase entendue</p>
                  <p className="mt-0.5 truncate text-xs italic text-gray-600" title={analysis.draft.transcript}>« {analysis.draft.transcript} »</p>
                </div>
                <button type="button" onClick={relancerDictee} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-600">
                  <RotateCcw size={15} /> Redicter
                </button>
              </div>
            </section>

            <section className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Animal{selectedNutravs.length > 1 ? "aux" : ""} détecté{selectedNutravs.length > 1 ? "s" : ""}</h3>
                <button type="button" onClick={() => setAnimalPickerOpen((ouvert) => !ouvert)} className="min-h-9 rounded-lg border border-gray-200 px-3 text-xs font-semibold text-green-700">
                  {selectedNutravs.length > 0 ? "Modifier" : "Rechercher"}
                </button>
              </div>
              {selectedAnimaux.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedAnimaux.map((animal) => (
                    <span key={animal.nutrav} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-green-50 px-2.5 text-sm text-green-900">
                      <strong>{animal.nutrav}</strong>{animal.nom ? ` · ${animal.nom}` : ""}
                      <button type="button" onClick={() => retirerAnimal(animal.nutrav)} className="rounded p-1 text-green-700" aria-label={`Retirer ${animal.nutrav}`}><X size={14} /></button>
                    </span>
                  ))}
                </div>
              ) : <p className="text-xs text-orange-700">Aucun animal confirmé.</p>}

              {analysis.draft.numerosNonTrouves.length > 0 && (
                <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-2.5">
                  <p className="text-xs font-semibold text-orange-800">Numéro{analysis.draft.numerosNonTrouves.length > 1 ? "s" : ""} non trouvé{analysis.draft.numerosNonTrouves.length > 1 ? "s" : ""}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {analysis.draft.numerosNonTrouves.map((numero) => (
                      <span key={numero} className="rounded-md bg-white px-2 py-1 font-mono text-xs font-semibold text-orange-800">{numero}</span>
                    ))}
                  </div>
                </div>
              )}

              {animalPickerOpen && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
                    <Search size={16} className="text-gray-400" />
                    <input value={animalQuery} onChange={(event) => setAnimalQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Numéro ou nom" autoFocus />
                  </label>
                  <div className="mt-2 max-h-44 overflow-y-auto">
                    {animauxFiltres.map((animal) => {
                      const selectionne = selectedNutravs.includes(animal.nutrav);
                      return (
                        <button key={animal.id} type="button" disabled={selectionne} onClick={() => choisirAnimal(animal.nutrav, animal.nobovi)} className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-green-50 disabled:opacity-45">
                          <strong className="text-green-800">{animal.nutrav}</strong><span className="truncate">{animal.nobovi || "Sans nom"}</span>{selectionne && <Check size={15} className="ml-auto text-green-700" />}
                        </button>
                      );
                    })}
                    {animauxFiltres.length === 0 && <p className="p-3 text-center text-xs text-gray-500">Aucun animal actif trouvé</p>}
                  </div>
                </div>
              )}
            </section>

            <section className="p-3">
              <h3 className="mb-2 text-sm font-semibold text-gray-900">Destination proposée</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {(showAllActions ? VOICE_ACTIONS : VOICE_ACTIONS.filter((action) => analysis.draft.suggestedActions.includes(action.id))).map((action) => (
                  <button key={action.id} type="button" onClick={() => setChosenAction(action.id)} className={`min-h-11 rounded-lg border px-3 text-left text-sm font-semibold ${chosenAction === action.id ? "border-green-600 bg-green-50 text-green-800" : "border-gray-200 text-gray-700"}`}>
                    {action.label}
                  </button>
                ))}
              </div>
              {!showAllActions && <button type="button" onClick={() => setShowAllActions(true)} className="mt-2 inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-gray-500">Autre <ChevronDown size={15} /></button>}
            </section>

            <section className="space-y-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Informations reconnues</h3>
                {chosenAction === "sanitaire" && (
                  <button type="button" onClick={() => void ouvrirRechercheMedicaments()} className="min-h-9 text-xs font-semibold text-blue-700">
                    {medicamentAEteEntendu ? "Changer le médicament" : "Ajouter un médicament"}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {informationsReconnues.map((information) => (
                  <span key={information} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">{information}</span>
                ))}
              </div>

              {chosenAction === "saillie" && (
                <div className="space-y-2 rounded-lg border border-green-100 bg-green-50/40 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-600">Action</span>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => mettreAJourDraft({ reproductionType: "NATURELLE" })} className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold ${analysis.draft.reproductionType !== "IA" ? "border-green-600 bg-white text-green-800" : "border-gray-200 bg-white text-gray-600"}`}>Saillie naturelle</button>
                      <button type="button" onClick={() => mettreAJourDraft({ reproductionType: "IA" })} className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold ${analysis.draft.reproductionType === "IA" ? "border-green-600 bg-white text-green-800" : "border-gray-200 bg-white text-gray-600"}`}>IA</button>
                    </div>
                  </div>
                  <div className="flex min-h-9 items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-gray-600">Taureau</span>
                    <div className="flex min-w-0 items-center gap-2">
                      <strong className="truncate text-sm text-gray-900">{analysis.draft.taureau?.nom ?? "Non reconnu"}</strong>
                      <button type="button" onClick={() => void ouvrirRechercheTaureaux()} className="min-h-9 shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-green-700">Modifier</button>
                    </div>
                  </div>

                  {taureauPickerOpen && (
                    <div className="rounded-lg border border-green-200 bg-white p-2">
                      <label className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
                        <Search size={16} className="text-gray-400" />
                        <input value={taureauQuery} onChange={(event) => setTaureauQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Nom ou numéro du taureau" autoFocus />
                      </label>
                      <div className="mt-1 max-h-36 overflow-y-auto">
                        {taureauxFiltres.map((taureau) => (
                          <button key={taureau.id} type="button" onClick={() => choisirTaureau(taureau)} className="flex min-h-10 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-sm hover:bg-green-50">
                            <span className="truncate font-semibold text-gray-800">{taureau.nopere ?? taureau.nupere}</span>
                            <span className="shrink-0 text-xs text-gray-400">{taureau.present ? "Naturelle" : "IA"}</span>
                          </button>
                        ))}
                        {taureauxFiltres.length === 0 && <p className="p-3 text-center text-xs text-gray-500">Aucun taureau trouvé</p>}
                      </div>
                      <button type="button" onClick={() => { mettreAJourDraft({ taureau: null }); setTaureauPickerOpen(false); }} className="min-h-9 w-full text-xs font-semibold text-gray-600">Aucun taureau</button>
                    </div>
                  )}
                </div>
              )}

              {chosenAction === "sanitaire" && !analysis.draft.medicament && analysis.draft.medicamentCandidates.length > 0 && (
                <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-2">
                  <p className="mb-1 text-[11px] text-gray-500">Médicament entendu : « {analysis.draft.medicamentEntendu} »</p>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.draft.medicamentCandidates.map((candidate) => <button key={candidate.id} type="button" onClick={() => void choisirMedicament(candidate.id, candidate.nom)} className="min-h-9 rounded-lg border border-blue-200 bg-white px-2.5 text-xs font-semibold text-blue-900">{candidate.nom}</button>)}
                  </div>
                </div>
              )}

              {chosenAction === "sanitaire" && medicamentPickerOpen && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-2">
                  <label className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3">
                    <Search size={16} className="text-gray-400" />
                    <input value={medicamentQuery} onChange={(event) => setMedicamentQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Écrire le nom du médicament" autoFocus />
                  </label>
                  <div className="mt-1 max-h-36 overflow-y-auto">
                    {medicamentsFiltres.map((medicament) => <button key={medicament.id} type="button" onClick={() => void choisirMedicament(medicament.id, medicament.nom)} className="min-h-10 w-full rounded-md px-2 text-left text-sm font-semibold text-gray-800 hover:bg-blue-50">{medicament.nom}{medicament.dci ? <span className="ml-2 font-normal text-gray-400">{medicament.dci}</span> : null}</button>)}
                    {medicamentsFiltres.length === 0 && <p className="p-3 text-center text-xs text-gray-500">Aucune correspondance</p>}
                  </div>
                  <button type="button" onClick={medicamentIntrouvable} className="min-h-9 w-full text-xs font-semibold text-gray-600">Médicament introuvable</button>
                </div>
              )}
              {learningError && <p className="text-xs text-orange-700">{learningError}</p>}
            </section>
          </div>
        </SelectionModal>
      )}
    </>
  );
}

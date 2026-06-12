"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, X } from "lucide-react";

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

type Status = "idle" | "listening" | "saving" | "saved" | "error";

const SILENCE_TIMEOUT_MS = 5000;

export default function VoiceButton() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedRef = useRef(false); // évite double-sauvegarde sur iOS

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }, []);

  function clearSilenceTimer() {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null; }
  }

  function clearHideTimer() {
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
  }

  function clearAfter(ms: number) {
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      setTranscript(null);
      setStatus("idle");
    }, ms);
  }

  async function saveNote(text: string) {
    setStatus("saving");
    try {
      const res = await fetch("/api/notes-terrain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte: text }),
      });
      setStatus(res.ok ? "saved" : "error");
      clearAfter(res.ok ? 4000 : 6000);
    } catch {
      setStatus("error");
      clearAfter(6000);
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
    if (!supported) return;

    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = "fr-FR";
    rec.continuous = false;      // iOS ne supporte pas continuous:true
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    savedRef.current = false;

    // Timeout de sécurité : 5s sans parole → arrêt automatique
    const armSilenceTimer = () => {
      clearSilenceTimer();
      silenceTimer.current = setTimeout(() => {
        stopRec();
      }, SILENCE_TIMEOUT_MS);
    };
    armSilenceTimer();

    rec.onresult = (event) => {
      if (savedRef.current) return; // iOS peut déclencher plusieurs fois
      savedRef.current = true;
      clearSilenceTimer();

      // Concatène tous les résultats (utile sur certains navigateurs)
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      text = text.trim();
      if (text) {
        setTranscript(text);
        saveNote(text);
      }
    };

    // Quand la voix s'arrête, relancer le timer de silence
    rec.onspeechend = () => { armSilenceTimer(); };

    rec.onend = () => {
      clearSilenceTimer();
      setStatus((prev) => prev === "listening" ? "idle" : prev);
    };

    rec.onerror = (e) => {
      clearSilenceTimer();
      const msg = e.error === "not-allowed"
        ? "Permission micro refusée"
        : e.error === "network"
        ? "Erreur réseau"
        : "Micro non disponible";
      setStatus("error");
      setTranscript(msg);
      clearAfter(5000);
    };

    recRef.current = rec;
    try {
      rec.start();
      setStatus("listening");
      setTranscript(null);
      clearHideTimer();
    } catch {
      setStatus("error");
      setTranscript("Impossible de démarrer le micro");
      clearAfter(4000);
    }
  }

  function dismiss() {
    clearHideTimer();
    setTranscript(null);
    setStatus("idle");
  }

  if (!supported) return null;

  const isListening = status === "listening";

  return (
    <>
      {/* Bulle de retour */}
      {(isListening || transcript || status === "saving" || status === "saved" || status === "error") && (
        <div className="fixed top-14 right-3 z-40 shadow-lg rounded-xl px-3 py-2.5 text-sm max-w-[270px] border bg-amber-50/95 border-amber-200 backdrop-blur-sm">
          {isListening && (
            <span className="text-amber-700 text-xs font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              Parle… (arrêt auto dans 5s)
            </span>
          )}
          {transcript && !isListening && (
            <div className="flex items-start gap-2">
              <span className="flex-1 italic text-amber-800 text-sm leading-snug">« {transcript} »</span>
              {(status === "saved" || status === "error") && (
                <button onClick={dismiss} className="text-amber-400 hover:text-amber-600 shrink-0 mt-px">
                  <X size={13} />
                </button>
              )}
            </div>
          )}
          {status === "saving" && (
            <span className="text-xs text-amber-600 font-medium block mt-1">Enregistrement…</span>
          )}
          {status === "saved" && (
            <span className="text-xs text-green-600 font-semibold block mt-1">✓ Note enregistrée</span>
          )}
          {status === "error" && transcript && (
            <span className="text-xs text-red-600 font-semibold block mt-1">✗ {transcript}</span>
          )}
        </div>
      )}

      {/* Bouton micro — un seul clic pour démarrer/arrêter */}
      <button
        onClick={toggle}
        aria-label={isListening ? "Arrêter l'enregistrement" : "Dicter une note"}
        title={isListening ? "Appuie pour arrêter" : "Appuie pour dicter une note"}
        className={`p-1.5 rounded-lg transition-colors touch-manipulation ${
          isListening
            ? "bg-red-500 text-white animate-pulse"
            : status === "saved"
            ? "bg-green-600 text-white"
            : "bg-amber-500 text-white hover:bg-amber-400"
        }`}
      >
        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
    </>
  );
}

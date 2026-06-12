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
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  transcript: string;
}

type Status = "idle" | "listening" | "saving" | "saved" | "error";

export default function VoiceButton() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognition | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }, []);

  function clearAfter(ms: number) {
    if (hideTimer.current) clearTimeout(hideTimer.current);
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

  function start() {
    if (!supported || status === "listening") return;
    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      saveNote(text);
    };
    rec.onend = () => {
      setStatus((prev) => prev === "listening" ? "idle" : prev);
    };
    rec.onerror = () => {
      setStatus("error");
      setTranscript("Micro non disponible");
      clearAfter(4000);
    };

    recRef.current = rec;
    rec.start();
    setStatus("listening");
    setTranscript(null);
  }

  function stop() {
    recRef.current?.stop();
  }

  function dismiss() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setTranscript(null);
    setStatus("idle");
  }

  if (!supported) return null;

  const isListening = status === "listening";

  return (
    <>
      {/* Bulle de retour */}
      {(transcript || status === "listening" || status === "saving" || status === "saved" || status === "error") && (
        <div className="fixed top-14 right-3 z-40 shadow-lg rounded-xl px-3 py-2.5 text-sm max-w-[270px] border bg-amber-50/95 border-amber-200 backdrop-blur-sm">
          {status === "listening" && !transcript && (
            <span className="text-amber-700 text-xs font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
              Parle maintenant…
            </span>
          )}
          {transcript && (
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
          {status === "error" && (
            <span className="text-xs text-red-600 font-semibold block mt-1">✗ Erreur — réessayer</span>
          )}
        </div>
      )}

      {/* Bouton micro unique */}
      <button
        onPointerDown={start}
        onPointerUp={isListening ? stop : undefined}
        onClick={!isListening ? start : undefined}
        aria-label={isListening ? "Arrêter l'enregistrement" : "Dicter une note"}
        title={isListening ? "Relâche pour enregistrer la note" : "Appuie pour dicter une note"}
        className={`p-1.5 rounded-lg transition-colors ${
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

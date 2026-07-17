"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";

interface NoteRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }>; resultIndex: number }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}

type SpeechWindow = Window & {
  SpeechRecognition?: new () => NoteRecognition;
  webkitSpeechRecognition?: new () => NoteRecognition;
};

type Status = "idle" | "listening" | "saving" | "saved" | "error";

export default function NoteVoiceButton() {
  const [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const recognitionRef = useRef<NoteRecognition | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    setSupported(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition));
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  function masquerApres(ms: number) {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setStatus("idle");
      setTranscript("");
      setMessage("");
    }, ms);
  }

  async function enregistrerNote(texte: string) {
    setStatus("saving");
    try {
      const response = await fetch("/api/notes-terrain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte }),
      });
      if (!response.ok) throw new Error();
      setStatus("saved");
      setMessage("Note enregistrée");
      masquerApres(5000);
    } catch {
      setStatus("error");
      setMessage("La note n’a pas pu être enregistrée");
      masquerApres(6000);
    }
  }

  function toggle() {
    if (status === "listening") {
      try { recognitionRef.current?.stop(); } catch {}
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) return;

    const recognition = new Constructor() as unknown as NoteRecognition;
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    handledRef.current = false;
    recognition.onresult = (event) => {
      if (handledRef.current) return;
      handledRef.current = true;
      let texte = "";
      for (let index = event.resultIndex; index < event.results.length; index++) texte += event.results[index][0].transcript;
      texte = texte.trim();
      if (texte) {
        setTranscript(texte);
        void enregistrerNote(texte);
      }
    };
    recognition.onend = () => setStatus((actuel) => actuel === "listening" ? "idle" : actuel);
    recognition.onerror = (event) => {
      setStatus("error");
      setMessage(event.error === "not-allowed" ? "Permission micro refusée" : "Micro non disponible");
      masquerApres(5000);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setStatus("listening");
      setTranscript("");
      setMessage("");
    } catch {
      setStatus("error");
      setMessage("Impossible de démarrer le micro");
      masquerApres(5000);
    }
  }

  if (!supported) return null;
  const listening = status === "listening";

  return (
    <>
      {status !== "idle" && (
        <div className="fixed right-3 top-14 z-40 max-w-[290px] rounded-xl border border-amber-200 bg-amber-50/95 px-3 py-2.5 text-sm shadow-lg backdrop-blur-sm">
          {listening ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Dicte ta note libre…</p>
          ) : (
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                {transcript && <p className="italic text-amber-900">Phrase entendue : « {transcript} »</p>}
                <p className={`mt-1 text-xs font-semibold ${status === "error" ? "text-red-600" : "text-green-700"}`}>{status === "saving" ? "Enregistrement…" : message}</p>
              </div>
              <button type="button" onClick={() => setStatus("idle")} className="rounded p-1 text-amber-500" aria-label="Fermer"><X size={15} /></button>
            </div>
          )}
        </div>
      )}
      <button type="button" onClick={toggle} aria-label={listening ? "Arrêter la note vocale" : "Dicter une note libre"} title="Dicter une note libre" className={`rounded-lg p-1.5 text-white transition ${listening ? "animate-pulse bg-red-500" : "bg-amber-500 hover:bg-amber-400"}`}>
        {listening ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
    </>
  );
}

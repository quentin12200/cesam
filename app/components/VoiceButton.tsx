"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, X, FileText, Navigation } from "lucide-react";

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

type VoiceMode = "commande" | "note";

function extractNutrav(t: string): string | null {
  // 4-digit number directly: "3878"
  const fourDigit = t.match(/\b(\d{4})\b/);
  if (fourDigit) return fourDigit[1];
  // Two adjacent 2-digit groups: "38 78" → "3878"
  const twoTwo = t.match(/\b(\d{2})\s+(\d{2})\b/);
  if (twoTwo) return twoTwo[1] + twoTwo[2];
  // 3-digit, pad to 4
  const three = t.match(/\b(\d{3})\b/);
  if (three) return three[1].padStart(4, "0");
  // 1-2 digit, pad to 4
  const short = t.match(/\b(\d{1,2})\b/);
  if (short) return short[1].padStart(4, "0");
  return null;
}

export default function VoiceButton() {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [mode, setMode] = useState<VoiceMode>("commande");
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle");
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }, []);

  const parseCommand = useCallback(
    (text: string) => {
      const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

      if (/\b(accueil|maison|home)\b/.test(t)) return router.push("/");
      if (/\btroupeau\b/.test(t)) {
        const last = sessionStorage.getItem("troupeau:lastUrl");
        return router.push(last || "/troupeau");
      }
      if (/\bsanitaire\b/.test(t)) return router.push("/sanitaire");
      if (/\b(reproduction|repro)\b/.test(t)) return router.push("/reproduction");
      if (/\bpharmacie\b/.test(t)) return router.push("/pharmacie");
      if (/\b(ordonnance|ordonnances)\b/.test(t)) return router.push("/ordonnances");
      if (/\b(velage|velages|v[eé]lage)\b/.test(t)) return router.push("/velage");
      if (/\bfinances?\b/.test(t)) return router.push("/finances");

      // Animal navigation — handles "38 78" → "3878"
      const nutrav = extractNutrav(t);
      if (nutrav) return router.push(`/troupeau/${nutrav}`);
    },
    [router]
  );

  async function saveNote(text: string) {
    setNoteStatus("saving");
    try {
      await fetch("/api/notes-terrain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texte: text }),
      });
      setNoteStatus("saved");
    } catch {
      setNoteStatus("idle");
    }
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setTranscript(null);
      setNoteStatus("idle");
    }, 4000);
  }

  const startListening = useCallback(() => {
    if (!supported || listening) return;
    const SpeechRec = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      if (mode === "commande") {
        parseCommand(text);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setTranscript(null), 3000);
      } else {
        saveNote(text);
      }
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); setTranscript(null); };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    setTranscript(null);
    setNoteStatus("idle");
  }, [supported, listening, mode, parseCommand]);

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  if (!supported) return null;

  const isNote = mode === "note";

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
      {/* Transcript / status bubble */}
      {(transcript || noteStatus !== "idle") && (
        <div className={`shadow-lg rounded-xl px-3 py-2.5 text-sm max-w-[240px] border flex flex-col gap-1.5 ${
          isNote ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"
        }`}>
          {transcript && (
            <div className="flex items-start gap-2">
              <span className={`flex-1 italic text-sm leading-snug ${isNote ? "text-amber-800" : "text-gray-600"}`}>
                « {transcript} »
              </span>
              {noteStatus === "idle" && (
                <button onClick={() => setTranscript(null)} className="text-gray-300 hover:text-gray-500 shrink-0 mt-px">
                  <X size={13} />
                </button>
              )}
            </div>
          )}
          {isNote && noteStatus === "saving" && (
            <span className="text-xs text-amber-600 font-medium">Enregistrement…</span>
          )}
          {isNote && noteStatus === "saved" && (
            <span className="text-xs text-green-600 font-semibold">✓ Note enregistrée</span>
          )}
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex rounded-xl overflow-hidden shadow border border-gray-200 bg-white">
        <button
          onClick={() => setMode("commande")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors ${
            !isNote ? "bg-green-700 text-white" : "text-gray-500 hover:bg-gray-50"
          }`}
          title="Mode navigation vocale"
        >
          <Navigation size={13} />
          Nav
        </button>
        <button
          onClick={() => setMode("note")}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors border-l border-gray-200 ${
            isNote ? "bg-amber-500 text-white" : "text-gray-500 hover:bg-gray-50"
          }`}
          title="Mode dictée de note terrain"
        >
          <FileText size={13} />
          Note
        </button>
      </div>

      {/* Mic button */}
      <button
        onClick={listening ? stopListening : startListening}
        aria-label={listening ? "Arrêter" : isNote ? "Dicter une note" : "Commande vocale"}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
          listening
            ? "bg-red-500 text-white animate-pulse"
            : isNote
            ? "bg-amber-500 text-white hover:bg-amber-400"
            : "bg-green-700 text-white hover:bg-green-600"
        }`}
      >
        {listening ? <MicOff size={22} /> : <Mic size={22} />}
      </button>
    </div>
  );
}

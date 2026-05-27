"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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

export default function VoiceButton() {
  const router = useRouter();
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
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

      // Navigation
      if (/\b(accueil|maison|home)\b/.test(t)) return router.push("/");
      if (/\btroupeau\b/.test(t)) {
        const last = sessionStorage.getItem("troupeau:lastUrl");
        return router.push(last || "/troupeau");
      }
      if (/\bsanitaire\b/.test(t)) return router.push("/sanitaire");
      if (/\b(reproduction|repro)\b/.test(t)) return router.push("/reproduction");
      if (/\bpharmacie\b/.test(t)) return router.push("/pharmacie");
      if (/\b(ordonnance|ordonnances)\b/.test(t)) return router.push("/ordonnances");
      if (/\b(velage|velages)\b/.test(t)) return router.push("/velage");
      if (/\bfinances?\b/.test(t)) return router.push("/finances");

      // Animal navigation: "vache 42" / "animal 0042" / "numéro 42"
      const numMatch = t.match(/\b(\d{1,4})\b/);
      if (numMatch) {
        const nutrav = numMatch[1].padStart(4, "0");
        return router.push(`/troupeau/${nutrav}`);
      }
    },
    [router]
  );

  const startListening = useCallback(() => {
    if (!supported || listening) return;
    const SpeechRec =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = false;

    rec.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);
      parseCommand(text);
      // Auto-hide transcript after 3 s
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setTranscript(null), 3000);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); setTranscript(null); };

    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    setTranscript(null);
  }, [supported, listening, parseCommand]);

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  if (!supported) return null;

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
      {transcript && (
        <div className="bg-white shadow-lg rounded-xl px-3 py-2 text-sm text-gray-700 max-w-[200px] border border-gray-200 flex items-start gap-2">
          <span className="flex-1 italic text-gray-600 truncate">{transcript}</span>
          <button onClick={() => setTranscript(null)} className="text-gray-300 hover:text-gray-500 shrink-0 mt-px">
            <X size={13} />
          </button>
        </div>
      )}
      <button
        onClick={listening ? stopListening : startListening}
        aria-label={listening ? "Arrêter" : "Commande vocale"}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-95 ${
          listening
            ? "bg-red-500 text-white animate-pulse"
            : "bg-green-700 text-white hover:bg-green-600"
        }`}
      >
        {listening ? <MicOff size={22} /> : <Mic size={22} />}
      </button>
    </div>
  );
}

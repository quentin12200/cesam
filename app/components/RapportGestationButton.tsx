"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export default function RapportGestationButton() {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");

  async function handleSend() {
    setStatus("sending");
    try {
      const res = await fetch("/api/cron/rapport-gestation?manual=1");
      setStatus(res.ok ? "ok" : "error");
    } catch {
      setStatus("error");
    }
    setTimeout(() => setStatus("idle"), 4000);
  }

  return (
    <button
      onClick={handleSend}
      disabled={status === "sending"}
      className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
        status === "ok"
          ? "bg-green-100 text-green-700"
          : status === "error"
          ? "bg-red-100 text-red-700"
          : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
      }`}
    >
      <Mail size={15} />
      {status === "sending" ? "Envoi…" : status === "ok" ? "✓ Email envoyé" : status === "error" ? "✗ Erreur" : "Envoyer rapport gestation"}
    </button>
  );
}

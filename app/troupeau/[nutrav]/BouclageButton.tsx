"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function BouclageButton({ nutrav, onConfirm }: { nutrav: string; onConfirm?: () => Promise<void> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    if (busy || !window.confirm("Confirmer que la boucle est posée ?")) return;
    setBusy(true); setError("");
    try {
      if (onConfirm) { await onConfirm(); return; }
      const response = await fetch("/api/animaux/" + encodeURIComponent(nutrav), {method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({boucleFaite:true})});
      if (!response.ok) throw new Error("Enregistrement impossible");
      router.refresh();
    } catch { setError("Bouclage non enregistré. Réessayez."); }
    finally { setBusy(false); }
  }
  return <span className="inline-flex flex-col"><button type="button" disabled={busy} onClick={confirm} className="min-h-11 rounded-lg bg-orange-100 px-3 text-xs font-semibold text-orange-800">{busy ? "Enregistrement…" : "Marquer bouclé"}</button>{error && <span role="alert" className="text-xs text-red-700">{error}</span>}</span>;
}

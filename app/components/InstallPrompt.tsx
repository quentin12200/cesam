"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { X, Share, Plus } from "lucide-react";

type Platform = "android" | "ios" | null;

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> } | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Enregistrement du service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    // Ne pas afficher si déjà installée en mode standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator && (navigator as { standalone?: boolean }).standalone === true);
    if (isStandalone) return;

    // Ne pas afficher si déjà ignoré dans cette session
    if (sessionStorage.getItem("installDismissed")) return;

    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
    const isAndroid = /Android/i.test(ua);

    if (isIos) {
      setPlatform("ios");
    }

    if (isAndroid) {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as typeof deferredPrompt);
        setPlatform("android");
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  function dismiss() {
    sessionStorage.setItem("installDismissed", "1");
    setDismissed(true);
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setDeferredPrompt(null);
  }

  if (dismissed || !platform) return null;

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 px-3 pb-2 pointer-events-none">
      <div className="bg-green-800 text-white rounded-2xl shadow-2xl p-4 pointer-events-auto max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <Image src="/logo-cesam.jpg" alt="CESAM" width={40} height={40} className="rounded-xl shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Installer CESAM</p>
            {platform === "android" && (
              <>
                <p className="text-xs text-green-200 mt-0.5">Accès rapide depuis votre écran d&apos;accueil, sans navigateur.</p>
                <button
                  onClick={install}
                  className="mt-2.5 flex items-center gap-1.5 bg-white text-green-800 font-semibold text-xs px-3 py-1.5 rounded-lg"
                >
                  <Plus size={14} />
                  Ajouter à l&apos;écran d&apos;accueil
                </button>
              </>
            )}
            {platform === "ios" && (
              <>
                <p className="text-xs text-green-200 mt-0.5">
                  Appuyez sur <Share size={12} className="inline mb-0.5" /> puis{" "}
                  <strong>&quot;Sur l&apos;écran d&apos;accueil&quot;</strong>
                </p>
              </>
            )}
          </div>
          <button onClick={dismiss} className="text-green-300 hover:text-white shrink-0 mt-0.5">
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

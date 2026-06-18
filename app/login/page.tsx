"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // Session déjà active ?
      const sessionRes = await fetch("/api/auth/session").catch(() => null);
      if (sessionRes?.ok) { router.replace(redirect); return; }

      // Retour d'une redirection Google ?
      try {
        const { getFirebaseApp } = await import("@/lib/firebase-client");
        const { getAuth, getRedirectResult, signOut } = await import("firebase/auth");
        const auth = getAuth(getFirebaseApp());
        // Timeout 5s pour éviter le spinner infini si getRedirectResult ne répond pas
        const result = await Promise.race([
          getRedirectResult(auth),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (result?.user) {
          await handleUser(result.user, signOut.bind(null, auth));
          return;
        }
      } catch (err) {
        console.warn("getRedirectResult:", err);
      }

      setLoading(false);
    }
    init();
  }, [redirect, router]); // eslint-disable-line

  async function handleUser(user: { getIdToken: () => Promise<string> }, signOutFn: () => Promise<void>) {
    const idToken = await user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (res.status === 403) {
      setError("Accès non autorisé. Le propriétaire a été notifié.");
      await signOutFn();
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setError("Erreur serveur. Réessayez.");
      setLoading(false);
      return;
    }
    router.replace(redirect);
  }

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    try {
      const { getFirebaseApp } = await import("@/lib/firebase-client");
      const { getAuth, signInWithPopup, signInWithRedirect, GoogleAuthProvider, signOut } = await import("firebase/auth");
      const auth = getAuth(getFirebaseApp());
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      try {
        // Popup en priorité (instantané, pas de rechargement de page)
        const result = await signInWithPopup(auth, provider);
        await handleUser(result.user, signOut.bind(null, auth));
      } catch (popupErr: unknown) {
        const code = (popupErr as { code?: string }).code ?? "";
        if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
          if (code === "auth/popup-closed-by-user") {
            setLoading(false);
            return;
          }
          // Popup bloqué → fallback redirect
          await signInWithRedirect(auth, provider);
        } else {
          throw popupErr;
        }
      }
    } catch {
      setError("Erreur de connexion Google. Réessayez.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <Image src="/logo-cesam.svg" alt="CESAM" width={64} height={64} className="rounded-xl" />
          <h1 className="text-xl font-bold text-gray-800">GAEC CESAM</h1>
          <p className="text-sm text-gray-500 text-center">Connectez-vous pour accéder à l&apos;application</p>
        </div>

        {error && (
          <div className="w-full bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors shadow-sm"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
          )}
          {loading ? "Vérification…" : "Continuer avec Google"}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Accès réservé aux membres du GAEC
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

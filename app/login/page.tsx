"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If already has a session cookie, go to app
    fetch("/api/auth/session", { method: "GET" }).then((r) => {
      if (r.ok) router.replace(redirect);
    }).catch(() => null);
  }, [redirect, router]);

  async function handleGoogleLogin() {
    setLoading(true);
    setError(null);
    try {
      const { getFirebaseApp } = await import("@/lib/firebase-client");
      const { getAuth, signInWithPopup, GoogleAuthProvider, signOut } = await import("firebase/auth");

      const auth = getAuth(getFirebaseApp());
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (res.status === 403) {
        setError("Accès non autorisé. Le propriétaire a été notifié.");
        await signOut(auth);
        return;
      }
      if (!res.ok) {
        setError("Erreur d'authentification. Réessayez.");
        return;
      }

      router.replace(redirect);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "auth/popup-closed-by-user") {
        setError(null);
      } else {
        setError("Erreur de connexion. Réessayez.");
      }
    } finally {
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
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {loading ? "Connexion…" : "Continuer avec Google"}
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

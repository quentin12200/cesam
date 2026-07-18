"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      const { getFirebaseApp } = await import("@/lib/firebase-client");
      const { getAuth, signOut } = await import("firebase/auth");
      await signOut(getAuth(getFirebaseApp()));
    } catch {}
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <button
      onClick={handleLogout}
      title="Se déconnecter"
      className="inline-flex h-9 w-9 items-center justify-center text-green-100 transition-colors hover:text-white"
    >
      <LogOut size={19} />
    </button>
  );
}

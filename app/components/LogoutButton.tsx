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
      className="p-1.5 rounded-lg transition-colors text-green-200 hover:bg-green-600 hover:text-white"
    >
      <LogOut size={18} />
    </button>
  );
}

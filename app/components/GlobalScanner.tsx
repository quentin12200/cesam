"use client";

import { Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation";

export default function GlobalScanner() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.push("/sanitaire/nouvel-evenement")}
      className="p-2 rounded-lg bg-green-600 hover:bg-green-500 transition-colors"
      title="Nouvel evenement sanitaire"
    >
      <Stethoscope size={20} />
    </button>
  );
}


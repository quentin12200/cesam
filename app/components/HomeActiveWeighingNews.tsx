"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Scale } from "lucide-react";
import { FIELD_SESSION_STORAGE_KEY, parseStoredFieldSession } from "@/lib/field-weighing-session";

const timeFormat = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

export default function HomeActiveWeighingNews({
  session,
}: {
  session: { id: string; startedAt: string; weightCount: number };
}) {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const cached = parseStoredFieldSession(localStorage.getItem(FIELD_SESSION_STORAGE_KEY));
    if (cached.weighingSessionId === session.id && cached.status === "ACTIVE") {
      setPendingCount(cached.pendingWeights.length);
    }
  }, [session.id]);

  return (
    <div className="flex min-h-14 items-center gap-3 rounded-lg border-l-4 border-l-green-700 bg-green-50 px-3 py-2">
      <Scale size={20} className="shrink-0 text-green-800" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-green-950">Pesée en cours</p>
        <p className="text-xs text-green-800">
          {session.weightCount} animal{session.weightCount > 1 ? "aux" : ""} · depuis {timeFormat.format(new Date(session.startedAt))}
          {pendingCount > 0 ? ` · ${pendingCount} en attente de synchronisation` : ""}
        </p>
      </div>
      <Link href="/troupeau/pesee" className="flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-bold text-green-900 underline">
        Reprendre <ArrowRight size={16} />
      </Link>
    </div>
  );
}

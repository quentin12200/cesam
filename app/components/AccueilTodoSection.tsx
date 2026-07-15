"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

export type AccueilTodoItem = {
  id: string;
  title: string;
  subject: string;
  due: string;
  priority: "urgent" | "soon" | "normal";
  order: number;
  href?: string;
  actionLabel: string;
  nutrav?: string;
  apiField?: string;
};

const PRIORITY = { urgent: 0, soon: 1, normal: 2 } as const;

const styles = {
  urgent: {
    row: "border-l-red-500",
    icon: "text-red-600",
    due: "text-red-700",
    button: "bg-red-600 text-white hover:bg-red-700",
  },
  soon: {
    row: "border-l-orange-400",
    icon: "text-orange-600",
    due: "text-orange-700",
    button: "bg-orange-500 text-white hover:bg-orange-600",
  },
  normal: {
    row: "border-l-gray-200",
    icon: "text-gray-400",
    due: "text-gray-500",
    button: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  },
};

export default function AccueilTodoSection({ items: initialItems }: { items: AccueilTodoItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [expanded, setExpanded] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...items].sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority] || a.order - b.order),
    [items]
  );
  const visible = expanded ? sorted : sorted.slice(0, 6);
  const hiddenCount = Math.max(0, sorted.length - visible.length);

  async function markDone(item: AccueilTodoItem) {
    if (!item.nutrav || !item.apiField || loadingId) return;
    setLoadingId(item.id);
    try {
      const response = await fetch(`/api/animaux/${item.nutrav}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [item.apiField]: true }),
      });
      if (!response.ok) throw new Error("Action impossible");
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section data-layout-section="accueil-a-faire" data-layout-label="À faire" className="rounded-xl bg-white p-4 shadow">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-900">À faire</h2>
        {sorted.length > 0 && (
          <span className="text-xs font-semibold tabular-nums text-gray-500">{sorted.length}</span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl bg-green-50 px-4 py-4 text-center">
          <CheckCircle2 className="mx-auto text-green-600" size={24} />
          <p className="mt-2 text-sm font-semibold text-green-800">Aucune intervention prioritaire</p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((item) => {
            const style = styles[item.priority];
            return (
              <article key={item.id} className={`flex items-center gap-3 rounded-lg border-l-[3px] bg-gray-50/70 px-3 py-2.5 ${style.row}`}>
                <AlertCircle size={18} className={`shrink-0 ${style.icon}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{item.title}</p>
                  <p className="truncate text-xs text-gray-600">{item.subject}</p>
                  <p className={`mt-0.5 text-[11px] font-semibold ${style.due}`}>{item.due}</p>
                </div>
                {item.href ? (
                  <Link href={item.href} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${style.button}`}>
                    {item.actionLabel}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={loadingId === item.id}
                    onClick={() => markDone(item)}
                    className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold disabled:opacity-50 ${style.button}`}
                  >
                    {loadingId === item.id ? "…" : item.actionLabel}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {hiddenCount > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          <ChevronDown size={15} /> Afficher {hiddenCount} autre{hiddenCount > 1 ? "s" : ""} priorité{hiddenCount > 1 ? "s" : ""}
        </button>
      )}
      {expanded && sorted.length > 6 && (
        <button type="button" onClick={() => setExpanded(false)} className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          <ChevronUp size={15} /> Réduire la liste
        </button>
      )}
    </section>
  );
}

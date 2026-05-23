"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface ChecklistItem {
  nutrav: string;
  nom: string | null;
  ageLabel: string;
  extra?: string;
  isUrgent?: boolean;
  apiField: string;
}

export interface SubItem {
  nutrav: string;
  nom: string | null;
  ageLabel: string;
  extra?: string;
}

const COLOR_MAP = {
  orange: {
    badge: "bg-orange-500 text-white",
    btn: "bg-orange-100 text-orange-800 hover:bg-orange-200 active:bg-orange-300",
    urgentRow: "bg-red-50 border-red-200",
    normalRow: "bg-orange-50 border-orange-100",
    header: "text-orange-800",
  },
  green: {
    badge: "bg-green-600 text-white",
    btn: "bg-green-100 text-green-800 hover:bg-green-200 active:bg-green-300",
    urgentRow: "bg-orange-50 border-orange-200",
    normalRow: "bg-green-50 border-green-100",
    header: "text-green-800",
  },
  blue: {
    badge: "bg-blue-600 text-white",
    btn: "bg-blue-100 text-blue-800 hover:bg-blue-200 active:bg-blue-300",
    urgentRow: "bg-orange-50 border-orange-200",
    normalRow: "bg-blue-50 border-blue-100",
    header: "text-blue-800",
  },
} as const;

function ItemRow({
  item,
  actionLabel,
  color,
  onDone,
}: {
  item: ChecklistItem;
  actionLabel: string;
  color: keyof typeof COLOR_MAP;
  onDone: (nutrav: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const c = COLOR_MAP[color];

  async function handleDone() {
    setLoading(true);
    try {
      await fetch(`/api/animaux/${item.nutrav}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [item.apiField]: true }),
      });
      onDone(item.nutrav);
    } catch {
      setLoading(false);
    }
  }

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border ${
        item.isUrgent ? c.urgentRow : c.normalRow
      }`}
    >
      <div className="flex-1 min-w-0 mr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/troupeau/${item.nutrav}`}
            className="font-mono font-bold text-sm text-green-700 hover:underline"
          >
            {item.nutrav}
          </Link>
          {item.nom && (
            <span className="text-sm font-medium text-gray-800">{item.nom}</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {item.ageLabel}
          {item.extra && <span> · {item.extra}</span>}
        </div>
      </div>
      <button
        onClick={handleDone}
        disabled={loading}
        className={`flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${c.btn} disabled:opacity-50`}
      >
        {loading ? "…" : `✓ ${actionLabel}`}
      </button>
    </div>
  );
}

export interface ChecklistSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ChecklistItem[];
  actionLabel: string;
  color: keyof typeof COLOR_MAP;
  subSection?: {
    title: string;
    items: SubItem[];
  };
}

export default function ChecklistSection({
  title,
  icon,
  items: initialItems,
  actionLabel,
  color,
  subSection,
}: ChecklistSectionProps) {
  const [items, setItems] = useState(initialItems);
  const [subOpen, setSubOpen] = useState(false);
  const c = COLOR_MAP[color];

  function handleDone(nutrav: string) {
    setItems((prev) => prev.filter((i) => i.nutrav !== nutrav));
  }

  if (items.length === 0 && (!subSection || subSection.items.length === 0)) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl shadow p-4">
      <h3 className={`font-semibold mb-3 flex items-center justify-between ${c.header}`}>
        <div className="flex items-center gap-2">
          {icon}
          {title}
        </div>
        {items.length > 0 && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
            {items.length}
          </span>
        )}
      </h3>

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <ItemRow
              key={item.nutrav}
              item={item}
              actionLabel={actionLabel}
              color={color}
              onDone={handleDone}
            />
          ))}
        </div>
      )}

      {subSection && subSection.items.length > 0 && (
        <div className={items.length > 0 ? "mt-3 pt-3 border-t border-gray-100" : ""}>
          <button
            onClick={() => setSubOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs text-gray-500 font-medium w-full py-1 hover:text-gray-700"
          >
            {subOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {subSection.title} ({subSection.items.length})
          </button>
          {subOpen && (
            <div className="space-y-2 mt-2">
              {subSection.items.map((item) => (
                <div
                  key={item.nutrav}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/troupeau/${item.nutrav}`}
                        className="font-mono font-bold text-xs text-green-700 hover:underline"
                      >
                        {item.nutrav}
                      </Link>
                      {item.nom && (
                        <span className="text-xs font-medium text-gray-700">{item.nom}</span>
                      )}
                    </div>
                    {(item.ageLabel || item.extra) && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {item.ageLabel}
                        {item.extra && <span> · {item.extra}</span>}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 ml-2">bientôt</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

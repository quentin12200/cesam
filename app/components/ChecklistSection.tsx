"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, CheckCircle2 } from "lucide-react";
import PrintSectionButton from "./PrintSectionButton";

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
  apiField?: string;
}

const COLOR_MAP = {
  orange: {
    badge: "bg-orange-500 text-white",
    btn: "bg-orange-100 text-orange-800 hover:bg-orange-200 active:bg-orange-300",
    urgentRow: "bg-red-50 border-red-200",
    normalRow: "bg-orange-50 border-orange-100",
    header: "text-orange-800",
    swipeBg: "bg-orange-500",
  },
  green: {
    badge: "bg-green-600 text-white",
    btn: "bg-green-100 text-green-800 hover:bg-green-200 active:bg-green-300",
    urgentRow: "bg-orange-50 border-orange-200",
    normalRow: "bg-green-50 border-green-100",
    header: "text-green-800",
    swipeBg: "bg-green-500",
  },
  blue: {
    badge: "bg-blue-600 text-white",
    btn: "bg-blue-100 text-blue-800 hover:bg-blue-200 active:bg-blue-300",
    urgentRow: "bg-orange-50 border-orange-200",
    normalRow: "bg-blue-50 border-blue-100",
    header: "text-blue-800",
    swipeBg: "bg-blue-500",
  },
} as const;

const SWIPE_THRESHOLD = 80;

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
  const [swipeDx, setSwipeDx] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [done, setDone] = useState(false);
  const touchStartX = useRef(0);
  const c = COLOR_MAP[color];

  async function markDone() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch(`/api/animaux/${item.nutrav}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [item.apiField]: true }),
      });
      setDone(true);
      setTimeout(() => onDone(item.nutrav), 350);
    } catch {
      setLoading(false);
      setSwipeDx(0);
    }
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    setSwiping(true);
  }

  function onTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - touchStartX.current;
    // Only allow left swipe (negative dx)
    if (dx < 0) setSwipeDx(Math.max(dx, -SWIPE_THRESHOLD - 20));
  }

  function onTouchEnd() {
    setSwiping(false);
    if (swipeDx <= -SWIPE_THRESHOLD) {
      markDone();
    } else {
      setSwipeDx(0);
    }
  }

  const progress = Math.min(Math.abs(swipeDx) / SWIPE_THRESHOLD, 1);

  if (done) {
    return (
      <div className={`flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50 opacity-0 transition-opacity duration-300`}>
        <CheckCircle2 size={18} className="text-green-500" />
        <span className="text-sm text-gray-400 line-through">{item.nutrav}</span>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Swipe background indicator */}
      <div
        className={`absolute inset-y-0 right-0 flex items-center justify-end px-4 ${c.swipeBg} transition-opacity`}
        style={{ opacity: progress, width: `${Math.abs(swipeDx) + 48}px` }}
      >
        <CheckCircle2 size={22} className="text-white" />
      </div>

      {/* Item content */}
      <div
        className={`flex items-center justify-between p-3 border touch-pan-y select-none ${
          item.isUrgent ? c.urgentRow : c.normalRow
        }`}
        style={{
          transform: `translateX(${swipeDx}px)`,
          transition: swiping ? "none" : "transform 0.25s ease",
          backgroundColor: undefined,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex-1 min-w-0 mr-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/troupeau/${item.nutrav}`}
              className="font-mono font-bold text-sm text-green-700 hover:underline"
              onClick={(e) => e.stopPropagation()}
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
          onClick={markDone}
          disabled={loading}
          className={`flex-shrink-0 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${c.btn} disabled:opacity-50`}
        >
          {loading ? "…" : `✓ ${actionLabel}`}
        </button>
      </div>
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
    actionLabel?: string;
  };
  printSectionId?: string;
}

function SubActionButton({
  item,
  actionLabel,
  color,
  onDone,
}: {
  item: SubItem;
  actionLabel: string;
  color: keyof typeof COLOR_MAP;
  onDone: (nutrav: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const c = COLOR_MAP[color];

  async function handleClick() {
    if (!item.apiField || loading) return;
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
    <button
      onClick={handleClick}
      disabled={loading}
      className={`flex-shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${c.btn} disabled:opacity-50`}
    >
      {loading ? "…" : actionLabel}
    </button>
  );
}

export default function ChecklistSection({
  title,
  icon,
  items: initialItems,
  actionLabel,
  color,
  subSection,
  printSectionId,
}: ChecklistSectionProps) {
  const [items, setItems] = useState(initialItems);
  const [subItems, setSubItems] = useState(subSection?.items ?? []);
  const [subOpen, setSubOpen] = useState(false);
  const c = COLOR_MAP[color];

  function handleDone(nutrav: string) {
    setItems((prev) => prev.filter((i) => i.nutrav !== nutrav));
  }

  function handleSubDone(nutrav: string) {
    setSubItems((prev) => prev.filter((i) => i.nutrav !== nutrav));
  }

  if (items.length === 0 && subItems.length === 0) {
    return null;
  }

  return (
    <div
      id={printSectionId}
      data-print-section={printSectionId ? "" : undefined}
      className="bg-white rounded-xl shadow p-4"
    >
      <h3 className={`font-semibold mb-3 flex items-center justify-between ${c.header}`}>
        <div className="flex items-center gap-2">
          {icon}
          {title}
        </div>
        <div className="flex items-center gap-2">
          {items.length > 0 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badge}`}>
              {items.length}
            </span>
          )}
          {printSectionId && (
            <PrintSectionButton
              sectionId={printSectionId}
              label={title}
              beforePrint={() => {
                if (!subSection || subOpen) return;
                setSubOpen(true);
                return new Promise((resolve) => setTimeout(resolve, 50));
              }}
            />
          )}
        </div>
      </h3>

      {/* Swipe hint (shown only if items > 0) */}
      {items.length > 0 && (
        <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
          ← Glisser pour cocher · ou bouton ✓
        </p>
      )}

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

      {subSection && subItems.length > 0 && (
        <div className={items.length > 0 ? "mt-3 pt-3 border-t border-gray-100" : ""}>
          <button
            onClick={() => setSubOpen((o) => !o)}
            className="flex items-center gap-1.5 text-xs text-gray-500 font-medium w-full py-1 hover:text-gray-700"
          >
            {subOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {subSection.title} ({subItems.length})
          </button>
          {subOpen && (
            <div className="space-y-2 mt-2">
              {subItems.map((item) => (
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
                  {item.apiField && subSection.actionLabel ? (
                    <SubActionButton
                      item={item}
                      actionLabel={subSection.actionLabel}
                      color={color}
                      onDone={handleSubDone}
                    />
                  ) : (
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">bientôt</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MoreVertical, Printer, TrendingUp, BarChart2, Network, Scissors } from "lucide-react";

export default function MoreMenu({ printHref }: { printHref: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const items = [
    { href: printHref, icon: Printer, label: "Imprimer la liste", color: "text-gray-500" },
    { href: "/troupeau/gmq", icon: TrendingUp, label: "Performances GMQ", color: "text-green-600" },
    { href: "/troupeau/performances", icon: BarChart2, label: "Performances vaches", color: "text-indigo-600" },
    { href: "/troupeau/genealogie", icon: Network, label: "Généalogie globale", color: "text-emerald-700" },
    { href: "/troupeau/sevrage", icon: Scissors, label: "Historique des sevrages", color: "text-orange-600" },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`p-2 rounded-lg shadow text-gray-500 hover:bg-gray-50 transition-colors ${open ? "bg-gray-100" : "bg-white"}`}
        title="Plus d'options"
        aria-label="Plus d'options"
      >
        <MoreVertical size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-56">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <item.icon size={16} className={item.color} />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

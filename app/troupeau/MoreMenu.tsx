"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { MoreVertical, Printer, Network, Scale, Scissors, Tags, History, Calculator } from "lucide-react";

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
    { href: "/troupeau/pesee", icon: Scale, label: "Pesée rapide", color: "text-black" },
    { href: "/troupeau/pesee/sessions", icon: History, label: "Séances de pesée", color: "text-green-700" },
    { href: "/troupeau/simulations-vente", icon: Calculator, label: "Simulations de vente", color: "text-amber-700" },
    { href: "/troupeau/identification", icon: Tags, label: "Identification", color: "text-violet-600" },
    { href: "/troupeau/sevrage", icon: Scissors, label: "Sevrage", color: "text-orange-600" },
    { href: "/troupeau/genealogie", icon: Network, label: "Généalogie", color: "text-emerald-700" },
    { href: printHref, icon: Printer, label: "Imprimer la liste", color: "text-gray-500" },
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
        <div
          role="menu"
          aria-label="Actions secondaires du troupeau"
          className="absolute right-0 top-full mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden w-56"
        >
          {items.map((item) => (
            <Link
              key={item.href}
              role="menuitem"
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

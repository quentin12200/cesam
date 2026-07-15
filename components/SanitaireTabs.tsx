"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/sanitaire", label: "Suivi sanitaire" },
  { href: "/pharmacie", label: "Pharmacie" },
];

export default function SanitaireTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Vues sanitaires" className="grid grid-cols-2 rounded-xl bg-gray-100 p-1">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`min-h-10 rounded-lg px-3 py-2 text-center text-sm font-semibold transition ${
              active ? "bg-white text-blue-800 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/troupeau", label: "Animaux" },
  { href: "/reproduction", label: "Reproduction" },
  { href: "/velage", label: "Vêlages" },
];

export default function TroupeauTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Vues du troupeau" className="grid grid-cols-3 rounded-xl bg-gray-100 p-1">
      {tabs.map((tab) => {
        const active =
          pathname === tab.href ||
          (tab.href === "/troupeau" && pathname.startsWith("/troupeau/"));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`min-h-10 rounded-lg px-2 py-2 text-center text-sm font-semibold transition ${
              active ? "bg-white text-green-800 shadow-sm" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

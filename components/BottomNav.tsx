"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Cow, RefreshCw, Shield, Baby } from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/troupeau", label: "Troupeau", icon: Cow },
  { href: "/reproduction", label: "Repro", icon: RefreshCw },
  { href: "/sanitaire", label: "Sanitaire", icon: Shield },
  { href: "/velage", label: "Vélage", icon: Baby },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 shadow-lg">
      <div className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center flex-1 py-2 gap-1 text-xs font-medium transition-colors ${
                isActive
                  ? "text-green-700 border-t-2 border-green-700"
                  : "text-gray-500"
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

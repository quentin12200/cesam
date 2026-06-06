"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, RefreshCw, Shield, Baby, Euro } from "lucide-react";
import CowIcon from "@/components/CowIcon";

const navItems = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/troupeau", label: "Troupeau", icon: CowIcon, restore: true },
  { href: "/reproduction", label: "Repro", icon: RefreshCw },
  { href: "/velage", label: "Vélage", icon: Baby },
  { href: "/sanitaire", label: "Sanitaire", icon: Shield },
  { href: "/finances", label: "Finances", icon: Euro },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex border-t border-green-600/40">
      {navItems.map(({ href, label, icon: Icon, restore }) => {
        const isActive =
          href === "/" ? pathname === "/" : pathname.startsWith(href);

        function handleClick(e: React.MouseEvent) {
          if (!restore) return;
          if (pathname.startsWith("/troupeau")) return;
          const lastUrl = sessionStorage.getItem("troupeau:lastUrl");
          if (lastUrl && lastUrl !== "/troupeau") {
            e.preventDefault();
            router.push(lastUrl);
          }
        }

        return (
          <Link
            key={href}
            href={href}
            onClick={restore ? handleClick : undefined}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 gap-0.5 transition-colors relative ${
              isActive
                ? "text-green-700"
                : "text-green-100 hover:text-white"
            }`}
          >
            {isActive && (
              <span className="absolute inset-x-1 inset-y-1 bg-white rounded-lg" />
            )}
            <Icon size={16} className="relative z-10" />
            <span className="text-[9px] font-semibold leading-tight relative z-10 tracking-wide">
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

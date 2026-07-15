"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Stethoscope, Euro } from "lucide-react";
import BullHeadIcon from "@/components/BullHeadIcon";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  paths?: string[];
};

const navItems: NavItem[] = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/troupeau", label: "Troupeau", icon: BullHeadIcon, paths: ["/troupeau", "/reproduction", "/velage"] },
  { href: "/sanitaire", label: "Sanitaire", icon: Stethoscope, paths: ["/sanitaire", "/pharmacie"] },
  { href: "/finances", label: "Finances", icon: Euro },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <div className="flex border-t border-green-600/40">
      {navItems.map(({ href, label, icon: Icon, paths }) => {
        const isActive =
          href === "/" ? pathname === "/" : (paths ?? [href]).some((path) => pathname.startsWith(path));


        return (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-col items-center justify-center flex-1 min-w-0 min-h-[58px] sm:min-h-[52px] py-2 sm:py-1.5 gap-1 border-r border-green-600/50 last:border-r-0 touch-manipulation transition-colors ${
              isActive
                ? "text-green-700"
                : "text-green-100 hover:text-white"
            }`}
          >
            {isActive && (
              <span className="absolute inset-x-1 inset-y-1 bg-white rounded-lg" />
            )}
            <Icon size={21} className="relative z-10" />
            <span className="text-[10px] font-bold leading-tight relative z-10">
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

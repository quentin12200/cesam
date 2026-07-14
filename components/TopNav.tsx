"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, RefreshCw, Stethoscope, Euro } from "lucide-react";
import BullHeadIcon from "@/components/BullHeadIcon";
import CalvingIcon from "@/components/CalvingIcon";

const navItems = [
  { href: "/", label: "Accueil", icon: Home },
  { href: "/troupeau", label: "Troupeau", icon: BullHeadIcon, restore: true },
  { href: "/reproduction", label: "Repro", icon: RefreshCw },
  { href: "/velage", label: "Vélage", icon: CalvingIcon },
  { href: "/sanitaire", label: "Sanitaire", icon: Stethoscope },
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

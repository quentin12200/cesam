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
  { href: "/sanitaire", label: "Sanitaire", icon: Stethoscope },
  { href: "/velage", label: "Vélage", icon: CalvingIcon },
  { href: "/finances", label: "Finances", icon: Euro },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 shadow-lg">
      <div className="flex">
        {navItems.map(({ href, label, icon: Icon, restore }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          function handleClick(e: React.MouseEvent) {
            if (!restore) return;
            // If already on troupeau, don't interfere
            if (pathname.startsWith("/troupeau")) return;
            // Restore last troupeau URL if available
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
              className={`relative flex flex-col items-center justify-center flex-1 min-h-[64px] py-2.5 gap-1.5 text-xs font-medium border-r last:border-r-0 border-gray-100 transition-colors ${
                isActive
                  ? "text-green-800 bg-green-50 border-t-[3px] border-t-green-700"
                  : "text-gray-600 hover:bg-gray-50 active:bg-gray-100"
              }`}
            >
              <Icon size={22} />
              <span className="text-[11px] font-semibold leading-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

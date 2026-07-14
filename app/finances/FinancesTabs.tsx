import Link from "next/link";
import { Euro, TrendingUp } from "lucide-react";

export default function FinancesTabs({ active }: { active: "economie" | "performances" }) {
  const tabs = [
    { id: "economie" as const, label: "Économie", href: "/finances", icon: Euro },
    { id: "performances" as const, label: "Performances", href: "/finances?onglet=performances", icon: TrendingUp },
  ];

  return (
    <nav className="grid grid-cols-2 bg-white border border-gray-200 rounded-lg overflow-hidden" aria-label="Rubriques Finances">
      {tabs.map(({ id, label, href, icon: Icon }) => (
        <Link
          key={id}
          href={href}
          className={`min-h-12 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-semibold transition-colors ${active === id ? "bg-green-700 text-white" : "text-gray-600 hover:bg-gray-50"}`}
          aria-current={active === id ? "page" : undefined}
        >
          <Icon size={18} />
          {label}
        </Link>
      ))}
    </nav>
  );
}

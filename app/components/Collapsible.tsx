"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface Props {
  title: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
  className?: string;
}

export default function Collapsible({
  title, defaultOpen = true, count, badge, badgeColor, children, className = "",
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-xl shadow overflow-hidden ${className}`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-gray-100 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="font-semibold text-gray-800 text-sm">{title}</span>
          {count !== undefined && (
            <span className="text-xs font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {count}
            </span>
          )}
          {badge && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${badgeColor ?? "bg-blue-100 text-blue-700"}`}>
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
        )}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

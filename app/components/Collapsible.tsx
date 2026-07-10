"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import PrintSectionButton from "./PrintSectionButton";

interface Props {
  title: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  badge?: string;
  badgeColor?: string;
  children: React.ReactNode;
  className?: string;
  printKey?: string;
}

export default function Collapsible({
  title, defaultOpen = true, count, badge, badgeColor, children, className = "", printKey,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`bg-white rounded-xl shadow overflow-hidden ${className}`}>
      <div className="flex items-center gap-1 border-b border-gray-100">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 min-w-0 flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
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
        {printKey && <PrintSectionButton printKey={printKey} className="mr-2" />}
      </div>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

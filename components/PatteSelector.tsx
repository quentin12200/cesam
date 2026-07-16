"use client";

import { PATTES_PARAGE, type PatteParage } from "@/lib/parage";

export default function PatteSelector({
  value,
  onChange,
}: {
  value: PatteParage[];
  onChange: (value: PatteParage[]) => void;
}) {
  function toggle(code: PatteParage) {
    onChange(value.includes(code) ? value.filter((patte) => patte !== code) : [...value, code]);
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PATTES_PARAGE.map((patte) => {
        const active = value.includes(patte.code);
        return (
          <button
            key={patte.code}
            type="button"
            onClick={() => toggle(patte.code)}
            aria-pressed={active}
            className={`min-h-11 rounded-lg border px-2 py-1.5 text-left transition-colors ${
              active
                ? "border-green-600 bg-green-50 text-green-800"
                : "border-gray-300 bg-white text-gray-600 hover:border-green-400"
            }`}
          >
            <span className="block text-sm font-bold">{patte.code}</span>
            <span className="block text-[11px] leading-tight">{patte.label}</span>
          </button>
        );
      })}
    </div>
  );
}

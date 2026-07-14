"use client";

import { useRouter } from "next/navigation";

export default function EconomyYearSelector({ value, years }: {
  value: number;
  years: number[];
}) {
  const router = useRouter();

  return (
    <label className="min-w-0 flex-1 sm:max-w-56">
      <span className="block text-xs font-medium text-gray-500 mb-1">Année affichée</span>
      <select
        value={value}
        onChange={(event) => router.push(`/finances?annee=${event.target.value}`)}
        className="w-full min-h-11 bg-white border border-gray-200 rounded-lg shadow-sm px-3 text-sm font-semibold text-gray-800"
      >
        {years.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </label>
  );
}

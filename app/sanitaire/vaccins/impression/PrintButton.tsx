"use client";

export default function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="no-print rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Imprimer</button>;
}

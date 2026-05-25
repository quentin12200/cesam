"use client";
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium print:hidden"
    >
      🖨️ Imprimer
    </button>
  );
}

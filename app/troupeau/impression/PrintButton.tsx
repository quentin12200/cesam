"use client";
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-white text-green-700 font-semibold text-sm px-4 py-1.5 rounded-lg"
    >
      Imprimer
    </button>
  );
}

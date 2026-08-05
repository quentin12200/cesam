export default function Loading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Chargement de la page"
      className="min-h-[55vh] bg-gray-100"
    >
      <div className="sticky top-0 z-20 h-1 overflow-hidden bg-green-100">
        <div className="h-full w-2/3 animate-pulse bg-green-700" />
      </div>

      <div className="mx-auto max-w-4xl space-y-4 p-4">
        <div className="flex items-center justify-center gap-3 rounded-xl bg-white p-5 shadow-sm">
          <span
            aria-hidden="true"
            className="h-7 w-7 animate-spin rounded-full border-4 border-green-200 border-t-green-700"
          />
          <p className="text-base font-semibold text-gray-700">Chargement…</p>
        </div>

        <div aria-hidden="true" className="space-y-3 animate-pulse">
          <div className="h-20 rounded-xl bg-white shadow-sm" />
          <div className="h-20 rounded-xl bg-white shadow-sm" />
          <div className="h-20 rounded-xl bg-white shadow-sm" />
        </div>
      </div>
    </div>
  );
}

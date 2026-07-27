"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Thermometer } from "lucide-react";

interface Props {
  animalId: string;
  animalLabel: string;
  observedAt: string;
  variant: "animal" | "home";
  simulationAware?: boolean;
}

export default function ActiveHeatAction({
  animalId,
  animalLabel,
  observedAt,
  variant,
  simulationAware = false,
}: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [simulationActive, setSimulationActive] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!simulationAware) return;

    const selector = document.querySelector<HTMLSelectElement>("[data-reproduction-preview-scenario]");
    const update = () => setSimulationActive(Boolean(selector && selector.value !== "real"));
    update();
    selector?.addEventListener("change", update);
    return () => selector?.removeEventListener("change", update);
  }, [simulationAware]);

  useEffect(() => {
    const remaining = new Date(observedAt).getTime() + 48 * 60 * 60 * 1000 - Date.now();
    if (remaining <= 0) {
      setExpired(true);
      return;
    }
    setExpired(false);
    const timer = window.setTimeout(() => setExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [observedAt]);

  if (simulationActive || expired) return null;

  const search = searchParams.toString();
  const returnTo = `${pathname}${search ? `?${search}` : ""}`;
  const actionHref = (type: "NATURELLE" | "IA") =>
    `/reproduction?action=saillie&animaux=${encodeURIComponent(animalId)}&type=${type}&returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <section
      aria-label="Action après chaleur observée"
      className={`rounded-xl border border-pink-200 bg-pink-50 ${
        variant === "animal" ? "mx-3 mt-2 p-3" : "p-3"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <Thermometer size={18} className="mt-0.5 shrink-0 text-pink-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-pink-900">
            {variant === "home"
              ? `Chaleur observée pour ${animalLabel}`
              : "Chaleur observée"}
          </p>
          <p className="mt-0.5 text-xs text-pink-800">
            {variant === "home"
              ? "Enregistrer une saillie ou une IA ?"
              : `Enregistrer une saillie ou une IA pour ${animalLabel} ?`}
          </p>
          <div className="mt-2 flex gap-2">
            <Link
              href={actionHref("NATURELLE")}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-green-700 px-3 text-sm font-semibold text-white hover:bg-green-800"
            >
              Saillie
            </Link>
            <Link
              href={actionHref("IA")}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
            >
              IA
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

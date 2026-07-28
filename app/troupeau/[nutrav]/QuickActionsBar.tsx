"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, ScanLine } from "lucide-react";
import { ACTION_VISUALS } from "@/components/action-visuals";
import { useOriginNavigation } from "@/lib/use-origin-navigation";
import { useReproductionModal } from "@/app/components/ReproductionModalProvider";
import EchoModal from "./EchoModal";

interface Props {
  animalId: string;
  nutrav: string;
  isFemelle: boolean;
  isActif: boolean;
  saillieId?: string | null;
  saillieDate?: string | null;
  testReproEnabled?: boolean;
  className?: string;
}

const ChaleurIcon = ACTION_VISUALS.chaleur.icon;
const SaillieIcon = ACTION_VISUALS.saillieIA.icon;
const EvenementIcon = ACTION_VISUALS.evenementSanitaire.icon;

export default function QuickActionsBar({
  animalId,
  nutrav,
  isFemelle,
  isActif,
  saillieId,
  saillieDate,
  testReproEnabled = false,
  className,
}: Props) {
  const router = useRouter();
  const { hrefWithOrigin } = useOriginNavigation();
  const { openReproductionModal } = useReproductionModal();
  const [echoOpen, setEchoOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  function openReproduction(action: "chaleur" | "saillie") {
    setMenuOpen(false);
    openReproductionModal({
      action,
      animals: [{ id: animalId, nutrav }],
      simulationAware: testReproEnabled,
    });
  }

  return (
    <>
      {isActif && (
        <div ref={menuRef} className={`relative ${className ?? "px-3 pt-2 pb-0.5"}`}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-800 active:scale-[0.97]"
          >
            <Plus size={19} />
            Ajouter
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute left-3 top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl"
            >
              {isFemelle && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setMenuOpen(false); setEchoOpen(true); }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-yellow-700 hover:bg-yellow-50"
                >
                  <ScanLine size={19} />
                  Échographie
                </button>
              )}
              {isFemelle && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openReproduction("chaleur")}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-pink-700 hover:bg-pink-50"
                >
                  <ChaleurIcon size={19} />
                  Chaleur
                </button>
              )}
              {isFemelle && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => openReproduction("saillie")}
                  className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-fuchsia-700 hover:bg-fuchsia-50"
                >
                  <SaillieIcon size={19} />
                  Saillie / IA
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => router.push(hrefWithOrigin(`/sanitaire/nouvel-evenement?animal=${encodeURIComponent(nutrav)}`))}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                <EvenementIcon size={19} />
                Événement
              </button>
            </div>
          )}
        </div>
      )}

      {echoOpen && (
        <EchoModal
          nutrav={nutrav}
          saillieId={saillieId}
          saillieDate={saillieDate}
          onClose={() => setEchoOpen(false)}
          onDone={() => {
            setEchoOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

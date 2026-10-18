"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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
  inlineActions?: boolean;
}


export default function QuickActionsBar({
  animalId,
  nutrav,
  isFemelle,
  isActif,
  saillieId,
  saillieDate,
  testReproEnabled = false,
  className,
  inlineActions = false,
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

  const actionClass = "flex min-h-12 min-w-0 items-center justify-center rounded-lg px-1.5 py-2 text-center text-xs font-semibold leading-tight";
  const actions = (
    <div className={isFemelle ? "grid grid-cols-3 gap-2" : "grid grid-cols-2 gap-2"} aria-label={`Actions individuelles pour ${nutrav}`}>
      {isFemelle && (
        <>
          <button type="button" onClick={() => openReproduction("saillie")} className={`${actionClass} bg-fuchsia-50 text-fuchsia-800`}>Saillie / IA</button>
          <button type="button" onClick={() => { setMenuOpen(false); setEchoOpen(true); }} className={`${actionClass} bg-amber-50 text-amber-800`}>Écho</button>
          <button type="button" onClick={() => openReproduction("chaleur")} className={`${actionClass} bg-pink-50 text-pink-800`}>Chaleur</button>
          <button type="button" onClick={() => router.push(hrefWithOrigin(`/velage?nouveau=1&mere=${encodeURIComponent(nutrav)}`))} className={`${actionClass} bg-emerald-50 text-emerald-800`}>Vêlage</button>
        </>
      )}
      <button type="button" onClick={() => router.push(hrefWithOrigin(`/sanitaire/nouvel-evenement?animal=${encodeURIComponent(nutrav)}`))} className={`${actionClass} bg-blue-50 text-blue-800`}>Événement</button>
      <button type="button" onClick={() => router.push(hrefWithOrigin(`/troupeau/pesee?animal=${encodeURIComponent(nutrav)}`))} className={`${actionClass} bg-slate-100 text-slate-800`}>Pesée</button>
    </div>
  );

  return (
    <>
      {isActif && (
        <div ref={menuRef} className={`relative ${className ?? "px-3 pt-2 pb-0.5"}`}>
          {inlineActions ? actions : (
            <>
              <button type="button" onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen} aria-haspopup="menu"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-800">
                <Plus size={19} /> Actions
              </button>
              {menuOpen && (
                <div role="menu" className="absolute left-0 top-full z-30 mt-1 w-[min(19rem,calc(100vw-3rem))] rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                  {actions}
                </div>
              )}
            </>
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

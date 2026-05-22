"use client";
import { useEffect, useState } from "react";

export default function SplashScreen() {
  // 0=caché 1=titre 2=sous-titre 3=ouverture 4=terminé
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // N'afficher qu'une fois par session
    if (sessionStorage.getItem("splashDone")) {
      setPhase(4);
      return;
    }
    sessionStorage.setItem("splashDone", "1");

    const timers = [
      setTimeout(() => setPhase(1), 100),   // CESAM apparaît
      setTimeout(() => setPhase(2), 900),   // "ouvre-toi" apparaît
      setTimeout(() => setPhase(3), 2000),  // portes s'ouvrent
      setTimeout(() => setPhase(4), 2900),  // fin
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  if (phase === 4) return null;

  const isOpening = phase >= 3;
  const textVisible = phase >= 1 && phase < 3;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      {/* Porte gauche */}
      <div
        className="absolute inset-y-0 left-0 w-1/2 bg-green-700 transition-transform duration-700 ease-in-out"
        style={{ transform: isOpening ? "translateX(-100%)" : "translateX(0)" }}
      />
      {/* Porte droite */}
      <div
        className="absolute inset-y-0 right-0 w-1/2 bg-green-700 transition-transform duration-700 ease-in-out"
        style={{ transform: isOpening ? "translateX(100%)" : "translateX(0)" }}
      />

      {/* Texte centré au-dessus des portes */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300"
        style={{ opacity: textVisible ? 1 : 0 }}
      >
        <h1
          className="text-white font-black tracking-widest transition-all duration-500"
          style={{
            fontSize: "clamp(3.5rem, 15vw, 7rem)",
            opacity: phase >= 1 ? 1 : 0,
            transform: phase >= 1 ? "scale(1)" : "scale(0.75)",
            letterSpacing: "0.15em",
          }}
        >
          CESAM
        </h1>
        <p
          className="text-green-200 italic mt-3 transition-all duration-500"
          style={{
            fontSize: "clamp(1rem, 4vw, 1.5rem)",
            opacity: phase >= 2 ? 1 : 0,
            transform: phase >= 2 ? "translateY(0)" : "translateY(12px)",
          }}
        >
          ouvre-toi&nbsp;✨
        </p>
      </div>
    </div>
  );
}

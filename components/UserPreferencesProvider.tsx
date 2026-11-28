"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type CesamProfile = "Céline" | "Samuel";

type PreferencesContextValue = {
  profile: CesamProfile;
  ready: boolean;
  setProfile: (profile: CesamProfile) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const PROFILE_KEY = "cesam:profil-actif";

export function UserPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfileState] = useState<CesamProfile>("Céline");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved === "Céline" || saved === "Samuel") setProfileState(saved);
    setReady(true);
  }, []);

  function setProfile(profileValue: CesamProfile) {
    localStorage.setItem(PROFILE_KEY, profileValue);
    setProfileState(profileValue);
  }

  return (
    <PreferencesContext.Provider value={{ profile, ready, setProfile }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function useActiveExecutor() {
  const context = useContext(PreferencesContext);
  return context?.ready ? context.profile : "";
}

export function useUserPreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("useUserPreferences doit être utilisé dans UserPreferencesProvider");
  return context;
}

// Simulation isolée : aucune lecture ni écriture du profil réel.
export function LabUserPreferencesProvider({children}:{children:React.ReactNode}) {
 const [profile,setProfile]=useState<CesamProfile>("Céline");
 return <PreferencesContext.Provider value={{profile,ready:true,setProfile}}>{children}</PreferencesContext.Provider>;
}

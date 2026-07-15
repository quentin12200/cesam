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

export function useUserPreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("useUserPreferences doit être utilisé dans UserPreferencesProvider");
  return context;
}

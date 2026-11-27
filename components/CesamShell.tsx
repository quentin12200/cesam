"use client";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import TopNav from "@/components/TopNav";
import SplashScreen from "@/components/SplashScreen";
import InstallPrompt from "@/app/components/InstallPrompt";
import GlobalScanner from "@/app/components/GlobalScanner";
import NoteVoiceButton from "@/app/components/NoteVoiceButton";
import UndoProvider from "@/app/components/UndoProvider";
import LogoutButton from "@/app/components/LogoutButton";
import Image from "next/image";
import NavigationRestoration from "@/app/components/NavigationRestoration";
import { UserPreferencesProvider } from "@/components/UserPreferencesProvider";
import GlobalSettingsButton from "@/components/GlobalSettingsButton";
import LayoutPersonalizer from "@/components/LayoutPersonalizer";
import ReturnNavigationConfirmation from "@/app/components/ReturnNavigationConfirmation";
import { ReproductionModalProvider } from "@/app/components/ReproductionModalProvider";
import GlobalDropdownDismissal from "@/components/GlobalDropdownDismissal";
import QuickSearch from "@/app/components/QuickSearch";
import { isLabRoute } from "@/lib/lab-route";
export default function CesamShell({children}: {children: React.ReactNode}) {
 const pathname=usePathname();
 if (isLabRoute(pathname)) return <main className="min-h-screen bg-slate-50"><div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-2 bg-blue-900 p-3 text-white"><strong>CESAM LAB · Données fictives</strong><a href="/config" className="inline-flex min-h-11 items-center rounded border border-white px-3 text-sm font-semibold">Quitter le Lab</a></div>{children}</main>;
 return <>
        <GlobalDropdownDismissal />
        <UserPreferencesProvider>
        <ReproductionModalProvider>
        <header className="print:hidden bg-green-700 text-white shadow-md sticky top-0 z-30 has-[[data-global-search-open]]:z-[60]">
          <div className="relative flex items-center justify-between gap-3 px-3 py-1.5 sm:px-4">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo-cesam.jpg"
                alt="CESAM"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <h1 className="hidden text-base font-bold tracking-wide xl:block">GAEC CESAM — Samuel &amp; Céline</h1>
            </div>
            <QuickSearch />
            <div className="flex items-center gap-1.5">
              <GlobalScanner />
              <NoteVoiceButton />
              <GlobalSettingsButton />
              <LogoutButton />
            </div>
          </div>
          <TopNav />
        </header>
        <UndoProvider>
          <Suspense fallback={null}>
            <NavigationRestoration />
            <ReturnNavigationConfirmation />
          </Suspense>
          <SplashScreen />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
          <LayoutPersonalizer />
          <InstallPrompt />
        </UndoProvider>
        </ReproductionModalProvider>
        </UserPreferencesProvider>
 </>;
}

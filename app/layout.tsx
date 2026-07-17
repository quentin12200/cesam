import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import "./globals.css";
import TopNav from "@/components/TopNav";
import SplashScreen from "@/components/SplashScreen";
import InstallPrompt from "@/app/components/InstallPrompt";
import NotificationBell from "@/app/components/NotificationBell";
import GlobalScanner from "@/app/components/GlobalScanner";
import NoteVoiceButton from "@/app/components/NoteVoiceButton";
import UndoProvider from "@/app/components/UndoProvider";
import LogoutButton from "@/app/components/LogoutButton";
import Image from "next/image";
import NavigationRestoration from "@/app/components/NavigationRestoration";
import { UserPreferencesProvider } from "@/components/UserPreferencesProvider";
import GlobalSettingsButton from "@/components/GlobalSettingsButton";
import LayoutPersonalizer from "@/components/LayoutPersonalizer";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GAEC CESAM",
  description: "Gestion de troupeau - Samuel & Céline",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo-cesam.jpg",
    shortcut: "/logo-cesam.jpg",
    apple: "/logo-cesam.jpg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CESAM",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-100">
        <UserPreferencesProvider>
        <header className="print:hidden bg-green-700 text-white shadow-md sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo-cesam.jpg"
                alt="CESAM"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <h1 className="text-base font-bold tracking-wide">GAEC CESAM — Samuel &amp; Céline</h1>
            </div>
            <div className="flex items-center gap-2">
              <GlobalScanner />
              <NoteVoiceButton />
              <NotificationBell />
              <GlobalSettingsButton />
              <LogoutButton />
            </div>
          </div>
          <TopNav />
        </header>
        <UndoProvider>
          <Suspense fallback={null}>
            <NavigationRestoration />
          </Suspense>
          <SplashScreen />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
          <LayoutPersonalizer />
          <InstallPrompt />
        </UndoProvider>
        </UserPreferencesProvider>
      </body>
    </html>
  );
}

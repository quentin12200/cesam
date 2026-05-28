import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SplashScreen from "@/components/SplashScreen";
import InstallPrompt from "@/app/components/InstallPrompt";
import NotificationBell from "@/app/components/NotificationBell";
import GlobalScanner from "@/app/components/GlobalScanner";
import VoiceButton from "@/app/components/VoiceButton";
import UndoProvider from "@/app/components/UndoProvider";
import Image from "next/image";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GAEC CESAM",
  description: "Gestion de troupeau - Samuel & Céline",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.svg",
    apple: "/favicon.svg",
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
      <body className="min-h-full flex flex-col bg-gray-100 pb-16">
        <header className="bg-green-700 text-white px-4 py-3 shadow-md sticky top-0 z-30">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo-cesam.svg"
                alt="CESAM"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <h1 className="text-lg font-bold tracking-wide">GAEC CESAM — Samuel &amp; Céline</h1>
            </div>
            <div className="flex items-center gap-2">
              <GlobalScanner />
              <NotificationBell />
            </div>
          </div>
        </header>
        <UndoProvider>
          <SplashScreen />
          <main className="flex-1 overflow-auto">
            {children}
          </main>
          <VoiceButton />
          <BottomNav />
          <InstallPrompt />
        </UndoProvider>
      </body>
    </html>
  );
}

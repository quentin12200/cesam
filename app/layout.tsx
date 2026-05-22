import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import BottomNav from "@/components/BottomNav";
import SplashScreen from "@/components/SplashScreen";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GAEC CESAM",
  description: "Gestion de troupeau - Samuel & Céline",
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
          <h1 className="text-lg font-bold tracking-wide">GAEC CESAM — Samuel &amp; Céline</h1>
        </header>
        <SplashScreen />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}

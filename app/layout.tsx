import CesamShell from "@/components/CesamShell";
import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "./home-cleanup.css";

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
        <CesamShell>{children}</CesamShell>
      </body>
    </html>
  );
}

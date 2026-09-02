import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/cesam-auth";

// Routes accessibles sans session valide.
// - login / accès refusé : pages publiques
// - prototype espace de travail : démonstration isolée avec données fictives
// - /api/auth/* : établit ou vérifie la session elle-même
// - /api/cron/* : appelées par Vercel Cron, s'authentifient via CRON_SECRET
const PUBLIC_PATHS = [
  "/login",
  "/acces-refuse",
  "/prototype-espace-travail",
  "/api/auth/session",
  "/api/auth/unauthorized",
  "/api/cron/",
];

// Ressources statiques / PWA à laisser passer.
const STATIC_PREFIXES = [
  "/_next/",
  "/favicon",
  "/icon",
  "/logo",
  "/manifest",
  "/firebase-messaging-sw",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    STATIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
    pathname === "/sw.js"
  ) {
    return NextResponse.next();
  }

  const email = await verifySessionToken(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  if (email) {
    return NextResponse.next();
  }

  // Les routes API répondent en JSON 401 plutôt qu'une redirection HTML.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

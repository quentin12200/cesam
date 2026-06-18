export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { differenceInDays } from "date-fns";
import { sendRapportGestation } from "@/lib/email-rapport-gestation";

const DESTINATAIRES = ["leyrat.quentin@gmail.com", "gaec.cesam@gmail.com"];

export async function GET(request: NextRequest) {
  // Cron Vercel ou appel manuel authentifié
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  const isManual = request.nextUrl.searchParams.get("manual") === "1";

  if (!isManual && (!secret || auth !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Appel manuel : vérifier le cookie de session
  if (isManual) {
    const cookie = request.headers.get("cookie") ?? "";
    if (!cookie.includes("cesam_session=")) {
      return NextResponse.json({ error: "Non connecté" }, { status: 401 });
    }
  }

  try {
    const now = new Date();

    const gestations = await prisma.gestation.findMany({
      where: {
        etat: { in: ["VERT", "ROSE", "GRIS"] },
        dateVelagePrevue: { not: null },
        saillie: { animal: { statut: "ACTIF" } },
        velage: null,
      },
      include: {
        saillie: {
          include: {
            animal: { select: { nobovi: true, nutrav: true } },
            taureau: { select: { nopere: true } },
          },
        },
      },
      orderBy: { dateVelagePrevue: "asc" },
    });

    const vaches = gestations
      .filter((g) => g.dateVelagePrevue != null)
      .map((g) => ({
        nobovi: g.saillie.animal.nobovi,
        nutrav: g.saillie.animal.nutrav,
        dateVelagePrevue: g.dateVelagePrevue!,
        joursRestants: differenceInDays(g.dateVelagePrevue!, now),
        etat: g.etat,
        pereNom: g.saillie.taureau?.nopere ?? null,
        dateSaillie: g.saillie.date,
      }))
      .filter((v) => v.joursRestants >= -7); // inclure vêlages en retard jusqu'à 7j

    await sendRapportGestation(vaches, DESTINATAIRES);

    return NextResponse.json({ ok: true, vaches: vaches.length });
  } catch (err) {
    console.error("rapport-gestation error:", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

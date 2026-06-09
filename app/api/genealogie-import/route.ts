import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { GENEA_DATA, nutravFromNat } from "./data";

export async function POST() {
  try {
    // Charger tous les animaux (nutrav → id)
    const animaux = await prisma.animal.findMany({
      select: { id: true, nutrav: true, nobovi: true },
    });
    const byNutrav = new Map(animaux.map((a) => [a.nutrav, a]));

    // Charger tous les taureaux (nutrav → id)
    const taureaux = await prisma.taureau.findMany({
      select: { id: true, nupere: true, nopere: true },
    });
    // Le nutrav du taureau = last 4 digits de nupere
    const taureauByNutrav = new Map(
      taureaux.map((t) => [nutravFromNat(t.nupere), t])
    );

    let mereOk = 0, mereKo = 0;
    let pereOk = 0, pereKo = 0;
    let veauKo = 0;
    const mereManquantes = new Set<string>();
    const veauxKo: string[] = [];

    for (const entry of GENEA_DATA) {
      const veauNutrav = nutravFromNat(entry.veauNat);
      const veau = byNutrav.get(veauNutrav);

      if (!veau) {
        veauKo++;
        veauxKo.push(entry.nom ?? entry.veauNat);
        continue;
      }

      // ── Lier la mère ──────────────────────────────────────────────────
      const mereNutrav = nutravFromNat(entry.mereNat);
      const mere = byNutrav.get(mereNutrav);

      if (mere) {
        await prisma.animal.update({
          where: { id: veau.id },
          data: { mereId: mere.id },
        });
        mereOk++;
      } else {
        mereKo++;
        mereManquantes.add(`${entry.mereNat} (nutrav ${mereNutrav})`);
      }

      // ── Mettre à jour le Velage avec le père ─────────────────────────
      const velage = await prisma.velage.findUnique({
        where: { veauId: veau.id },
        select: { id: true },
      });

      if (velage) {
        const taureau = taureauByNutrav.get(nutravFromNat(entry.pereNat));
        await prisma.velage.update({
          where: { id: velage.id },
          data: {
            pereNom: entry.pereNom,
            pereNunati: entry.pereNat,
          },
        });
        pereOk++;

        // Lier le taureau via la saillie si elle existe
        if (taureau) {
          const gestation = await prisma.gestation.findFirst({
            where: { velage: { id: velage.id } },
            select: { saillieId: true },
          });
          if (gestation?.saillieId) {
            await prisma.saillie.update({
              where: { id: gestation.saillieId },
              data: { taureauId: taureau.id },
            }).catch(() => {/* saillie peut ne pas exister */});
          }
        }
      } else {
        pereKo++;
      }
    }

    return NextResponse.json({
      ok: true,
      total: GENEA_DATA.length,
      mere: { ok: mereOk, ko: mereKo },
      pere: { ok: pereOk, ko: pereKo },
      veauxNonTrouves: veauKo,
      mereManquantes: [...mereManquantes].slice(0, 20),
      veauxKoListe: veauxKo.slice(0, 20),
    });
  } catch (err) {
    console.error("genealogie-import error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

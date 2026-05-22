import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Augmenter le timeout Vercel à 60s (nécessaire pour le seed complet)
export const maxDuration = 60;

function d(str: string): Date {
  const [day, month, year] = str.split("/");
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

function mkNunati(nutrav: string): string {
  return "FR82" + nutrav.padStart(6, "0");
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");

  if (!process.env.SEED_SECRET || secret !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: "Non autorisé. Ajoutez ?secret=VOTRE_TOKEN" }, { status: 401 });
  }

  const log: string[] = [];

  try {
    // ── NETTOYAGE ──────────────────────────────────────────
    log.push("🧹 Nettoyage...");
    await prisma.evenementSanitaire.deleteMany();
    await prisma.vaccination.deleteMany();
    await prisma.pesee.deleteMany();
    await prisma.parage.deleteMany();
    await prisma.complementAlim.deleteMany();
    await prisma.velage.deleteMany();
    await prisma.gestation.deleteMany();
    await prisma.saillie.deleteMany();
    await prisma.animal.deleteMany();
    await prisma.taureau.deleteMany();

    // ── CAPTEURS ───────────────────────────────────────────
    for (let i = 1; i <= 4; i++) {
      await prisma.capteurVelage.upsert({
        where: { numero: i },
        update: {},
        create: { numero: i, actif: false, updatedAt: new Date() },
      });
    }
    log.push("✅ 4 capteurs");

    // ── LOCALISATIONS ──────────────────────────────────────
    const locs = [
      { nom: "Vialette", type: "PRE" },
      { nom: "Tour Ronde", type: "PRE" },
      { nom: "Préonde", type: "PRE" },
      { nom: "Vieille stabulation", type: "BATIMENT" },
      { nom: "Nouvelle stabulation", type: "BATIMENT" },
      { nom: "Chez Jacques", type: "EXTERNE" },
    ];
    for (const loc of locs) {
      await prisma.localisation.upsert({ where: { nom: loc.nom }, update: {}, create: loc });
    }
    log.push("✅ Localisations");

    // ── TAUREAUX ───────────────────────────────────────────
    const taureauData = [
      { nupere: "PEPINO",    nopere: "Pepino",    present: true },
      { nupere: "MICKEY",    nopere: "Mickey",    present: true },
      { nupere: "ZEUS",      nopere: "Zeus",      present: true },
      { nupere: "ULYSSE",    nopere: "Ulysse",    present: true },
      { nupere: "ARGUS",     nopere: "Argus",     present: true },
      { nupere: "SPIDERMAN", nopere: "Spiderman", present: true },
      { nupere: "ONDENC",    nopere: "ONDENC",    present: true },
      { nupere: "UMETXO",    nopere: "UMETXO",   present: true },
      { nupere: "PATUA",     nopere: "PATUA",     present: true },
      { nupere: "BIZCAI",    nopere: "BIZCAI",    present: false },
      { nupere: "ILLUSTRE",  nopere: "illustre",  present: false },
      { nupere: "ANIS",      nopere: "anis",      present: false },
      { nupere: "NARUTO",    nopere: "Naruto",    present: false },
      { nupere: "PIXAN",     nopere: "Pixan",     present: false },
      { nupere: "RAPACE",    nopere: "Rapace",    present: false },
    ];

    const taureauIds: Record<string, string> = {};
    for (const t of taureauData) {
      const taureau = await prisma.taureau.create({
        data: { ...t, copaip: "FR", updatedAt: new Date() },
      });
      taureauIds[t.nupere] = taureau.id;
    }
    log.push(`✅ ${taureauData.length} taureaux`);

    function tid(nom: string | null | undefined): string | null {
      if (!nom) return null;
      return taureauIds[nom.toUpperCase()] ?? null;
    }

    // ── VACHES PLEINES (44) ────────────────────────────────
    type VachePleine = {
      nutrav: string; danais: string; dernierVelage?: string;
      pere?: string; dateSaillie?: string; dateVelagePrevue?: string; notes?: string;
    };

    const vachesPleineDonnees: VachePleine[] = [
      { nutrav: "555",  danais: "01/06/2016", dernierVelage: "07/11/2025", pere: "PEPINO", dateSaillie: "02/03/2026", dateVelagePrevue: "02/12/2026", notes: "Jumeaux?" },
      { nutrav: "580",  danais: "01/06/2016", dernierVelage: "20/02/2025", pere: "MICKEY", dateSaillie: "30/08/2025", dateVelagePrevue: "30/05/2026" },
      { nutrav: "586",  danais: "01/06/2016", dernierVelage: "30/10/2025", pere: "PEPINO", dateSaillie: "22/12/2025", dateVelagePrevue: "22/09/2026" },
      { nutrav: "588",  danais: "01/06/2016", dernierVelage: "11/09/2025", pere: "MICKEY", dateSaillie: "30/11/2025", dateVelagePrevue: "30/08/2026", notes: "III METRABOL" },
      { nutrav: "655",  danais: "01/06/2016", dernierVelage: "10/12/2025", pere: "PEPINO", dateSaillie: "16/03/2026", dateVelagePrevue: "16/12/2026", notes: "Bioule" },
      { nutrav: "659",  danais: "01/06/2021",                              pere: "ULYSSE", dateSaillie: "21/11/2025", dateVelagePrevue: "21/08/2026", notes: "Femelle ?" },
      { nutrav: "756",  danais: "01/06/2016", dernierVelage: "10/02/2025", pere: "MICKEY", dateSaillie: "17/08/2025", dateVelagePrevue: "17/05/2026" },
      { nutrav: "816",  danais: "01/06/2021",                                                                                                         notes: "Bioule" },
      { nutrav: "820",  danais: "01/06/2021",                                                                                                         notes: "Bioule" },
      { nutrav: "1293", danais: "01/06/2016", dernierVelage: "01/12/2024", pere: "MICKEY", dateSaillie: "08/06/2025", dateVelagePrevue: "08/03/2026" },
      { nutrav: "1325", danais: "01/06/2016", dernierVelage: "22/12/2024", pere: "ZEUS",   dateSaillie: "11/06/2025", dateVelagePrevue: "11/03/2026" },
      { nutrav: "1331", danais: "01/06/2016", dernierVelage: "02/12/2024", pere: "ZEUS",   dateSaillie: "08/06/2025", dateVelagePrevue: "08/03/2026" },
      { nutrav: "1333", danais: "01/06/2016", dernierVelage: "27/11/2024", pere: "ZEUS",   dateSaillie: "03/06/2025", dateVelagePrevue: "03/03/2026" },
      { nutrav: "1335", danais: "01/06/2016", dernierVelage: "21/01/2025", pere: "ZEUS",   dateSaillie: "22/07/2025", dateVelagePrevue: "22/04/2026" },
      { nutrav: "1357", danais: "01/06/2016", dernierVelage: "10/12/2024", pere: "ZEUS",   dateSaillie: "08/06/2025", dateVelagePrevue: "08/03/2026" },
      { nutrav: "1359", danais: "01/06/2016", dernierVelage: "08/12/2024", pere: "MICKEY", dateSaillie: "08/06/2025", dateVelagePrevue: "08/03/2026" },
      { nutrav: "3226", danais: "01/06/2016", dernierVelage: "17/11/2024", pere: "MICKEY", dateSaillie: "18/05/2025", dateVelagePrevue: "18/02/2026" },
      { nutrav: "3228", danais: "01/06/2016", dernierVelage: "22/10/2024", pere: "ZEUS",   dateSaillie: "01/05/2025", dateVelagePrevue: "01/02/2026" },
      { nutrav: "3235", danais: "01/06/2016", dernierVelage: "18/11/2024", pere: "ZEUS",   dateSaillie: "18/05/2025", dateVelagePrevue: "18/02/2026" },
      { nutrav: "3237", danais: "01/06/2016", dernierVelage: "18/11/2024", pere: "ZEUS",   dateSaillie: "18/05/2025", dateVelagePrevue: "18/02/2026" },
      { nutrav: "3238", danais: "01/06/2016", dernierVelage: "05/12/2024", pere: "ZEUS",   dateSaillie: "05/06/2025", dateVelagePrevue: "05/03/2026" },
      { nutrav: "3244", danais: "01/06/2016", dernierVelage: "04/12/2024", pere: "MICKEY", dateSaillie: "05/06/2025", dateVelagePrevue: "05/03/2026" },
      { nutrav: "3245", danais: "01/06/2016", dernierVelage: "15/11/2024", pere: "ZEUS",   dateSaillie: "15/05/2025", dateVelagePrevue: "15/02/2026" },
      { nutrav: "3249", danais: "01/06/2016", dernierVelage: "27/10/2024", pere: "MICKEY", dateSaillie: "27/04/2025", dateVelagePrevue: "27/01/2026" },
      { nutrav: "3253", danais: "01/06/2016", dernierVelage: "16/11/2024", pere: "ZEUS",   dateSaillie: "16/05/2025", dateVelagePrevue: "16/02/2026" },
      { nutrav: "3254", danais: "01/06/2016", dernierVelage: "24/11/2024", pere: "MICKEY", dateSaillie: "24/05/2025", dateVelagePrevue: "24/02/2026" },
      { nutrav: "3256", danais: "01/06/2016", dernierVelage: "11/11/2024", pere: "ZEUS",   dateSaillie: "11/05/2025", dateVelagePrevue: "11/02/2026" },
      { nutrav: "3257", danais: "01/06/2016", dernierVelage: "10/11/2024", pere: "MICKEY", dateSaillie: "10/05/2025", dateVelagePrevue: "10/02/2026" },
      { nutrav: "3260", danais: "01/06/2016", dernierVelage: "09/11/2024", pere: "ZEUS",   dateSaillie: "09/05/2025", dateVelagePrevue: "09/02/2026" },
      { nutrav: "3263", danais: "01/06/2016", dernierVelage: "23/11/2024", pere: "ZEUS",   dateSaillie: "23/05/2025", dateVelagePrevue: "23/02/2026" },
      { nutrav: "3264", danais: "01/06/2016", dernierVelage: "28/11/2024", pere: "MICKEY", dateSaillie: "28/05/2025", dateVelagePrevue: "28/02/2026" },
      { nutrav: "3266", danais: "01/06/2016", dernierVelage: "11/12/2024", pere: "MICKEY", dateSaillie: "11/06/2025", dateVelagePrevue: "11/03/2026" },
      { nutrav: "3268", danais: "01/06/2016", dernierVelage: "05/11/2024", pere: "MICKEY", dateSaillie: "05/05/2025", dateVelagePrevue: "05/02/2026" },
      { nutrav: "3269", danais: "01/06/2016", dernierVelage: "11/11/2024", pere: "ZEUS",   dateSaillie: "11/05/2025", dateVelagePrevue: "11/02/2026" },
      { nutrav: "3270", danais: "01/06/2016", dernierVelage: "17/11/2024", pere: "MICKEY", dateSaillie: "17/05/2025", dateVelagePrevue: "17/02/2026" },
      { nutrav: "3272", danais: "01/06/2016", dernierVelage: "18/10/2024", pere: "ZEUS",   dateSaillie: "18/04/2025", dateVelagePrevue: "18/01/2026" },
      { nutrav: "3275", danais: "01/06/2016", dernierVelage: "24/11/2024", pere: "ZEUS",   dateSaillie: "24/05/2025", dateVelagePrevue: "24/02/2026" },
      { nutrav: "3277", danais: "01/06/2016", dernierVelage: "15/11/2024", pere: "MICKEY", dateSaillie: "15/05/2025", dateVelagePrevue: "15/02/2026" },
      { nutrav: "3278", danais: "01/06/2016", dernierVelage: "24/11/2024", pere: "MICKEY", dateSaillie: "24/05/2025", dateVelagePrevue: "24/02/2026" },
      { nutrav: "3279", danais: "01/06/2016", dernierVelage: "09/11/2024", pere: "MICKEY", dateSaillie: "09/05/2025", dateVelagePrevue: "09/02/2026" },
      { nutrav: "3280", danais: "01/06/2016", dernierVelage: "28/10/2024", pere: "MICKEY", dateSaillie: "28/04/2025", dateVelagePrevue: "28/01/2026" },
      { nutrav: "3281", danais: "01/06/2016", dernierVelage: "08/12/2024", pere: "MICKEY", dateSaillie: "08/06/2025", dateVelagePrevue: "08/03/2026" },
      { nutrav: "5516", danais: "01/06/2020", dernierVelage: "01/02/2025", pere: "MICKEY", dateSaillie: "29/08/2025", dateVelagePrevue: "29/05/2026" },
      { nutrav: "5517", danais: "01/06/2020",                              pere: "ULYSSE", dateSaillie: "21/11/2025", dateVelagePrevue: "21/08/2026" },
    ];

    // ── VACHES VIDES (24) ──────────────────────────────────
    type VacheVide = {
      nutrav: string; danais: string; estGenisse?: boolean;
      dernierVelage?: string; notes?: string;
    };

    const vachesVideDonnees: VacheVide[] = [
      { nutrav: "568",  danais: "01/06/2016", dernierVelage: "20/04/2026", notes: "BOLUS 01/04/25" },
      { nutrav: "592",  danais: "01/06/2016", dernierVelage: "08/05/2026" },
      { nutrav: "777",  danais: "01/06/2016", dernierVelage: "03/01/2026", notes: "métrite" },
      { nutrav: "957",  danais: "01/06/2018" },
      { nutrav: "961",  danais: "01/06/2018" },
      { nutrav: "1356", danais: "01/06/2016", dernierVelage: "24/01/2025" },
      { nutrav: "1358", danais: "01/06/2016", dernierVelage: "30/01/2025" },
      { nutrav: "3232", danais: "01/06/2016", dernierVelage: "12/01/2025" },
      { nutrav: "3233", danais: "01/06/2016", dernierVelage: "20/01/2025" },
      { nutrav: "3246", danais: "01/06/2016", dernierVelage: "31/01/2025" },
      { nutrav: "3247", danais: "01/06/2016", dernierVelage: "28/01/2025" },
      { nutrav: "3265", danais: "01/06/2016", dernierVelage: "05/02/2025" },
      { nutrav: "3267", danais: "01/06/2016", dernierVelage: "15/01/2025" },
      { nutrav: "3273", danais: "01/06/2016", dernierVelage: "04/02/2025" },
      { nutrav: "3276", danais: "01/06/2016", dernierVelage: "22/01/2025" },
      { nutrav: "5518", danais: "01/06/2022", estGenisse: true },
      { nutrav: "5519", danais: "01/06/2022", estGenisse: true },
      { nutrav: "5520", danais: "01/06/2022", estGenisse: true },
      { nutrav: "7959", danais: "01/06/2023", estGenisse: true },
      { nutrav: "7960", danais: "01/06/2023", estGenisse: true },
      { nutrav: "7963", danais: "01/06/2023", estGenisse: true },
      { nutrav: "7965", danais: "01/06/2023", estGenisse: true },
      { nutrav: "7967", danais: "01/06/2023", estGenisse: true },
      { nutrav: "7968", danais: "01/06/2023", estGenisse: true },
    ];

    // ── CRÉATION VACHES PLEINES ────────────────────────────
    const animalIds: Record<string, string> = {};

    for (const v of vachesPleineDonnees) {
      const animal = await prisma.animal.create({
        data: {
          nunati: mkNunati(v.nutrav),
          nutrav: v.nutrav,
          danais: d(v.danais),
          sexbov: "F",
          statut: "ACTIF",
          estGenisse: false,
          notes: v.notes ?? null,
          taureauId: tid(v.pere),
          updatedAt: new Date(),
        },
      });
      animalIds[v.nutrav] = animal.id;

      if (v.dernierVelage) {
        await prisma.velage.create({
          data: { date: d(v.dernierVelage), qualificatif: "NORMAL", vacheId: animal.id, updatedAt: new Date() },
        });
      }

      if (v.dateSaillie && v.dateVelagePrevue) {
        const saillie = await prisma.saillie.create({
          data: { animalId: animal.id, date: d(v.dateSaillie), type: "SN", taureauId: tid(v.pere), updatedAt: new Date() },
        });
        await prisma.gestation.create({
          data: { saillieId: saillie.id, etat: "VERT", dateVelagePrevue: d(v.dateVelagePrevue), updatedAt: new Date() },
        });
      }
    }
    log.push(`✅ ${vachesPleineDonnees.length} vaches pleines`);

    // ── CRÉATION VACHES VIDES ──────────────────────────────
    for (const v of vachesVideDonnees) {
      const animal = await prisma.animal.create({
        data: {
          nunati: mkNunati(v.nutrav),
          nutrav: v.nutrav,
          danais: d(v.danais),
          sexbov: "F",
          statut: "ACTIF",
          estGenisse: v.estGenisse ?? false,
          notes: v.notes ?? null,
          updatedAt: new Date(),
        },
      });
      animalIds[v.nutrav] = animal.id;

      if (v.dernierVelage) {
        await prisma.velage.create({
          data: { date: d(v.dernierVelage), qualificatif: "NORMAL", vacheId: animal.id, updatedAt: new Date() },
        });
      }

      if (v.nutrav === "777") {
        await prisma.evenementSanitaire.create({
          data: { animalId: animal.id, type: "METRITE", date: d("03/01/2026"), description: "Métrite post-vélage", resolu: false, updatedAt: new Date() },
        });
      }
    }
    log.push(`✅ ${vachesVideDonnees.length} vaches vides`);

    // ── VEAUX ──────────────────────────────────────────────
    const veauxDonnees = [
      { nutrav: "7492", danais: "01/11/2024", sexbov: "M", mereNutrav: "592",  pereNom: "Zeus",   boucleFaite: true },
      { nutrav: "7491", danais: "01/11/2024", sexbov: "F", mereNutrav: "3281", pereNom: "Mickey", boucleFaite: true },
      { nutrav: "7490", danais: "01/11/2024", sexbov: "M", mereNutrav: "3235", pereNom: "Zeus",   boucleFaite: true },
      { nutrav: "9262", danais: "20/04/2026", sexbov: "M", mereNutrav: "568",  pereNom: null,     boucleFaite: true },
    ];

    for (const v of veauxDonnees) {
      const mereId = animalIds[v.mereNutrav] ?? null;
      const veau = await prisma.animal.create({
        data: {
          nunati: mkNunati(v.nutrav),
          nutrav: v.nutrav,
          danais: d(v.danais),
          sexbov: v.sexbov,
          statut: "ACTIF",
          estGenisse: false,
          boucleFaite: v.boucleFaite,
          mereId,
          updatedAt: new Date(),
        },
      });
      animalIds[v.nutrav] = veau.id;

      if (mereId) {
        await prisma.velage.create({
          data: { date: d(v.danais), qualificatif: "NORMAL", vacheId: mereId, veauId: veau.id, pereNom: v.pereNom, updatedAt: new Date() },
        });
      }
    }
    log.push(`✅ ${veauxDonnees.length} veaux`);

    // ── RÉSUMÉ ─────────────────────────────────────────────
    const totalVaches    = await prisma.animal.count({ where: { sexbov: "F", estGenisse: false } });
    const totalGenisses  = await prisma.animal.count({ where: { estGenisse: true } });
    const totalVeaux     = await prisma.animal.count({ where: { sexbov: "M" } });
    const totalGestations= await prisma.gestation.count({ where: { etat: "VERT" } });
    const totalVelages   = await prisma.velage.count();

    const résumé = {
      vaches: totalVaches,
      génisses: totalGenisses,
      veaux: totalVeaux,
      gestationsConfirmées: totalGestations,
      vélages: totalVelages,
    };

    log.push("🎉 Seed terminé !");

    return NextResponse.json({ success: true, log, résumé });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.push(`❌ Erreur : ${message}`);
    return NextResponse.json({ success: false, log, error: message }, { status: 500 });
  }
}

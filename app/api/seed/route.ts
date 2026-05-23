import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Augmenter le timeout Vercel à 60s (nécessaire pour le seed complet)
export const maxDuration = 60;

function d(str: string): Date {
  const [day, month, year] = str.split("/");
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
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
    // Taureaux IA/externes du CSV (NUPERE qui ne sont pas dans NUTRAV)
    // + taureaux IA historiques gardés du seed précédent
    const taureauData = [
      // Pères du CSV (externes, non présents dans le troupeau)
      { nupere: "1218072074", nopere: "ODORANT",   present: false },
      { nupere: "2226701938", nopere: "NERON",      present: false },
      { nupere: "2278701332", nopere: "LUCKY",      present: false },
      { nupere: "3100361906", nopere: "HASHTAG",    present: false },
      { nupere: "5343396600", nopere: "GAELIC",     present: false },
      { nupere: "6413382190", nopere: "HAPPY",      present: false },
      { nupere: "6414325024", nopere: "LOUP",       present: false },
      { nupere: "6414587588", nopere: "NEGARREZ",   present: false },
      { nupere: "6415300087", nopere: "SOLEIL",     present: false },
      { nupere: "7,0415E+11", nopere: "LANCER",     present: false },
      { nupere: "7934931561", nopere: "HELLO",      present: false },
      { nupere: "8160151325", nopere: "SCAPIN",     present: false },
      // Taureaux IA historiques
      { nupere: "PEPINO",     nopere: "Pepino",     present: false },
      { nupere: "ULYSSE",     nopere: "Ulysse",     present: false },
      { nupere: "ARGUS",      nopere: "Argus",      present: false },
      { nupere: "SPIDERMAN",  nopere: "Spiderman",  present: false },
      { nupere: "ONDENC",     nopere: "ONDENC",     present: false },
      { nupere: "UMETXO",     nopere: "UMETXO",     present: false },
      { nupere: "PATUA",      nopere: "PATUA",      present: false },
      { nupere: "BIZCAI",     nopere: "BIZCAI",     present: false },
      { nupere: "ILLUSTRE",   nopere: "illustre",   present: false },
      { nupere: "ANIS",       nopere: "anis",       present: false },
      { nupere: "NARUTO",     nopere: "Naruto",     present: false },
      { nupere: "PIXAN",      nopere: "Pixan",      present: false },
      { nupere: "RAPACE",     nopere: "Rapace",     present: false },
    ];

    for (const t of taureauData) {
      await prisma.taureau.create({
        data: { ...t, copaip: "FR", updatedAt: new Date() },
      });
    }
    log.push(`✅ ${taureauData.length} taureaux`);

    // ── ANIMAUX (166 du CSV BDNI) ──────────────────────────
    type CsvAnimal = {
      nutrav: string; nunati: string; nobovi: string | null; danais: string;
      sexbov: string; causen: string; numeip: string | null; nomeip: string | null;
      tramip: string | null; copami: string | null; copaip: string;
      nupere: string | null; estGenisse: boolean; boucleFaite: boolean;
    };

    const csvAnimaux: CsvAnimal[] = [
      { nutrav: "94", nunati: "FR8223010094", nobovi: "ULM", danais: "09/10/2023", sexbov: "F", causen: "A", numeip: "8220012349", nomeip: "SAMBA", tramip: "79", copami: "FR", copaip: "FR", nupere: "6415300087", estGenisse: false, boucleFaite: true },
      { nutrav: "95", nunati: "FR8223010095", nobovi: "UPSA", danais: "17/10/2023", sexbov: "F", causen: "A", numeip: "8220211677", nomeip: "SAVANTE", tramip: "79", copami: "FR", copaip: "FR", nupere: "6415300087", estGenisse: false, boucleFaite: true },
      { nutrav: "555", nunati: "FR8160070555", nobovi: null, danais: "10/01/2020", sexbov: "F", causen: "A", numeip: "8125298204", nomeip: "FANNY", tramip: "79", copami: "FR", copaip: "FR", nupere: "5343396600", estGenisse: false, boucleFaite: true },
      { nutrav: "568", nunati: "FR8160070568", nobovi: null, danais: "12/04/2020", sexbov: "F", causen: "A", numeip: "8160114854", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: "5343396600", estGenisse: false, boucleFaite: true },
      { nutrav: "580", nunati: "FR8222010580", nobovi: "TAIGA", danais: "21/02/2022", sexbov: "F", causen: "A", numeip: "8213012435", nomeip: "IARO", tramip: "79", copami: "FR", copaip: "FR", nupere: "2278701332", estGenisse: false, boucleFaite: true },
      { nutrav: "586", nunati: "FR8222010586", nobovi: "TANGO", danais: "14/03/2022", sexbov: "F", causen: "A", numeip: "8213012420", nomeip: "ISSINO", tramip: "79", copami: "FR", copaip: "FR", nupere: "2278701332", estGenisse: false, boucleFaite: true },
      { nutrav: "588", nunati: "FR8160070588", nobovi: "MINNIE", danais: "23/06/2020", sexbov: "F", causen: "A", numeip: "8160313085", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: "6413382190", estGenisse: false, boucleFaite: true },
      { nutrav: "592", nunati: "FR8160070592", nobovi: "HERBE", danais: "09/07/2020", sexbov: "F", causen: "A", numeip: "3100240495", nomeip: "FANNY", tramip: "79", copami: "FR", copaip: "FR", nupere: "7934931561", estGenisse: false, boucleFaite: true },
      { nutrav: "655", nunati: "FR8222010655", nobovi: "TABA", danais: "24/10/2022", sexbov: "F", causen: "A", numeip: "8220012288", nomeip: "RECENTE", tramip: "79", copami: "FR", copaip: "FR", nupere: "3100361906", estGenisse: false, boucleFaite: true },
      { nutrav: "659", nunati: "FR8222010659", nobovi: "TABOU", danais: "03/11/2022", sexbov: "F", causen: "A", numeip: "8219013340", nomeip: "RATINE", tramip: "79", copami: "FR", copaip: "FR", nupere: "3100361906", estGenisse: false, boucleFaite: true },
      { nutrav: "756", nunati: "FR8235430756", nobovi: "JUDITH", danais: "06/11/2013", sexbov: "F", causen: "N", numeip: "8235351875", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "777", nunati: "FR8235430777", nobovi: null, danais: "25/05/2014", sexbov: "F", causen: "N", numeip: "8235361007", nomeip: "PAQUES", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "816", nunati: "FR8224010816", nobovi: "VALENCE", danais: "16/07/2024", sexbov: "F", causen: "A", numeip: "8216013151", nomeip: "MUSTER", tramip: "79", copami: "FR", copaip: "FR", nupere: "8160151325", estGenisse: false, boucleFaite: true },
      { nutrav: "817", nunati: "FR8224010817", nobovi: "VIVACE", danais: "18/07/2024", sexbov: "F", causen: "A", numeip: "8220213979", nomeip: "SABLE", tramip: "79", copami: "FR", copaip: "FR", nupere: "6415300087", estGenisse: false, boucleFaite: true },
      { nutrav: "820", nunati: "FR8224010820", nobovi: "VIOLETTE", danais: "19/09/2024", sexbov: "F", causen: "A", numeip: "8220213971", nomeip: "SOJA", tramip: "79", copami: "FR", copaip: "FR", nupere: "6415300087", estGenisse: false, boucleFaite: true },
      { nutrav: "957", nunati: "FR8235590957", nobovi: "VIENNOISE", danais: "03/10/2024", sexbov: "F", causen: "N", numeip: "8235529323", nomeip: "COURAGEUSE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "961", nunati: "FR8235590961", nobovi: "VAPOREUSE", danais: "19/10/2024", sexbov: "F", causen: "N", numeip: "8235474463", nomeip: "MERINGUE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "962", nunati: "FR8235590962", nobovi: "VOLUPTE", danais: "23/10/2024", sexbov: "F", causen: "N", numeip: "8235506377", nomeip: "OLYMPE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "963", nunati: "FR8235590963", nobovi: "VITAMINE", danais: "24/10/2024", sexbov: "F", causen: "N", numeip: "8235529326", nomeip: "RIHANNA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "964", nunati: "FR8235590964", nobovi: "VACANCE", danais: "24/10/2024", sexbov: "F", causen: "N", numeip: "4632709235", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "977", nunati: "FR8235590977", nobovi: "VODKA", danais: "02/12/2024", sexbov: "F", causen: "N", numeip: "8235543542", nomeip: "SIXTINE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "978", nunati: "FR8235590978", nobovi: "VANDA", danais: "26/12/2024", sexbov: "F", causen: "N", numeip: "8235529327", nomeip: "RIGOLOTE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "984", nunati: "FR8235590984", nobovi: "ABY", danais: "17/01/2025", sexbov: "F", causen: "N", numeip: "8235464421", nomeip: "MIRABELLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: false },
      { nutrav: "986", nunati: "FR8235590986", nobovi: "ALOUETTE", danais: "24/01/2025", sexbov: "F", causen: "N", numeip: "1220153235", nomeip: "RATATINE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: false },
      { nutrav: "989", nunati: "FR8235590989", nobovi: "ALICE", danais: "01/02/2025", sexbov: "F", causen: "N", numeip: "1220153281", nomeip: "REINETTE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: false },
      { nutrav: "993", nunati: "FR8235590993", nobovi: "PAQUES", danais: "20/04/2025", sexbov: "F", causen: "N", numeip: "8235474459", nomeip: "MEDAILLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: false },
      { nutrav: "996", nunati: "FR8235590996", nobovi: "ADORA", danais: "04/06/2025", sexbov: "F", causen: "N", numeip: "8235493890", nomeip: "OASIS", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: false },
      { nutrav: "998", nunati: "FR8235590998", nobovi: "ARTEMIS", danais: "25/06/2025", sexbov: "F", causen: "N", numeip: "8235529317", nomeip: "REVEUSE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: false },
      { nutrav: "999", nunati: "FR8235590999", nobovi: "ABONDANCE", danais: "24/07/2025", sexbov: "F", causen: "N", numeip: "8235444148", nomeip: "LENTILLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: false },
      { nutrav: "1000", nunati: "FR8235591000", nobovi: "SIMCA", danais: "12/08/2025", sexbov: "M", causen: "N", numeip: "8235419854", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: false },
      { nutrav: "1001", nunati: "FR8235591001", nobovi: "NUITS", danais: "16/08/2025", sexbov: "F", causen: "N", numeip: "8235482124", nomeip: "NYMPHEA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: false },
      { nutrav: "1002", nunati: "FR8235591002", nobovi: "ATHENA", danais: "20/08/2025", sexbov: "F", causen: "N", numeip: "8235436101", nomeip: "LARA CROFT", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: false },
      { nutrav: "1003", nunati: "FR8235361003", nobovi: "FANNY", danais: "07/04/2010", sexbov: "F", causen: "N", numeip: "8235305934", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "1331", nunati: "FR8235571331", nobovi: "TAMARIS", danais: "30/12/2022", sexbov: "F", causen: "N", numeip: "8235409559", nomeip: "ISIS", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "1333", nunati: "FR8235571333", nobovi: "UGUETTE", danais: "10/01/2023", sexbov: "F", causen: "N", numeip: "8235506376", nomeip: "OPHELIE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "1335", nunati: "FR8235571335", nobovi: "ULYA", danais: "14/01/2023", sexbov: "F", causen: "N", numeip: "8235444148", nomeip: "LENTILLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "1357", nunati: "FR8235571357", nobovi: "ULLY", danais: "07/06/2023", sexbov: "F", causen: "N", numeip: "3100317284", nomeip: "DAROLES", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "1370", nunati: "FR8235571370", nobovi: "ULTRABELLE", danais: "27/09/2023", sexbov: "F", causen: "N", numeip: "8235409540", nomeip: "SAUTERELLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "1520", nunati: "FR1221371520", nobovi: null, danais: "08/10/2023", sexbov: "M", causen: "A", numeip: "1214426323", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "2124", nunati: "FR8235482124", nobovi: "NYMPHEA", danais: "21/01/2017", sexbov: "F", causen: "N", numeip: "4636864695", nomeip: "COLOMBE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "2659", nunati: "FR3210932659", nobovi: "VERY OLD", danais: "25/04/2010", sexbov: "F", causen: "A", numeip: "3206746660", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "3235", nunati: "FR1220153235", nobovi: "RATATINE", danais: "29/04/2020", sexbov: "F", causen: "A", numeip: "1216010634", nomeip: "MADONE", tramip: "79", copami: "FR", copaip: "FR", nupere: "6414325024", estGenisse: false, boucleFaite: true },
      { nutrav: "3257", nunati: "FR1220153257", nobovi: "REMISE", danais: "26/05/2020", sexbov: "F", causen: "A", numeip: "1209059201", nomeip: "DATCHA", tramip: "79", copami: "FR", copaip: "FR", nupere: "6414325024", estGenisse: false, boucleFaite: true },
      { nutrav: "3281", nunati: "FR1220153281", nobovi: "REINETTE", danais: "04/08/2020", sexbov: "F", causen: "A", numeip: "1217008550", nomeip: "NANOU", tramip: "79", copami: "FR", copaip: "FR", nupere: "6414587588", estGenisse: false, boucleFaite: true },
      { nutrav: "3533", nunati: "FR8235543533", nobovi: "SHAKIRA", danais: "13/11/2021", sexbov: "F", causen: "N", numeip: "8235409540", nomeip: "SAUTERELLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "3535", nunati: "FR8235543535", nobovi: "SHADOW", danais: "20/11/2021", sexbov: "F", causen: "N", numeip: "8235444151", nomeip: "LADY", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "3540", nunati: "FR8235543540", nobovi: "SISTER", danais: "05/12/2021", sexbov: "F", causen: "N", numeip: "8235474442", nomeip: "MARELLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "3542", nunati: "FR8235543542", nobovi: "SIXTINE", danais: "09/12/2021", sexbov: "F", causen: "N", numeip: "8235325835", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "3543", nunati: "FR8235543543", nobovi: "SYNDICALE", danais: "13/12/2021", sexbov: "F", causen: "N", numeip: "8235444148", nomeip: "LENTILLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "3753", nunati: "FR8235373753", nobovi: null, danais: "28/03/2011", sexbov: "F", causen: "N", numeip: "4649047440", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "3890", nunati: "FR8235493890", nobovi: "OASIS", danais: "05/06/2018", sexbov: "F", causen: "N", numeip: "8235350249", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "4143", nunati: "FR8235444143", nobovi: "LAVANDE", danais: "13/01/2015", sexbov: "F", causen: "N", numeip: "4724006409", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "4148", nunati: "FR8235444148", nobovi: "LENTILLE", danais: "21/03/2015", sexbov: "F", causen: "N", numeip: "8235351875", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "4151", nunati: "FR8235444151", nobovi: "LADY", danais: "07/04/2015", sexbov: "F", causen: "N", numeip: "8235288034", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "4152", nunati: "FR8235444152", nobovi: "LOLA", danais: "12/04/2015", sexbov: "F", causen: "N", numeip: "8235350262", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "4286", nunati: "FR8235554286", nobovi: "SABA", danais: "28/12/2021", sexbov: "F", causen: "A", numeip: "8215015870", nomeip: "LOLA", tramip: "79", copami: "FR", copaip: "FR", nupere: "1218072074", estGenisse: false, boucleFaite: true },
      { nutrav: "4339", nunati: "FR8224014339", nobovi: "TOBITWO", danais: "05/02/2025", sexbov: "F", causen: "A", numeip: "802368067", nomeip: "8067 RIGA", tramip: "66", copami: "FR", copaip: "FR", nupere: "7,0415E+11", estGenisse: false, boucleFaite: false },
      { nutrav: "4421", nunati: "FR8235464421", nobovi: "MIRABELLE", danais: "13/03/2016", sexbov: "F", causen: "N", numeip: "8235394790", nomeip: "NIKITA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "4442", nunati: "FR8235474442", nobovi: "MARELLE", danais: "10/07/2016", sexbov: "F", causen: "N", numeip: "4636864704", nomeip: "CANDIE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "4451", nunati: "FR8235474451", nobovi: "TOTOSSE", danais: "10/10/2016", sexbov: "F", causen: "N", numeip: "8235325829", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "4460", nunati: "FR8223014460", nobovi: "UTOPIE", danais: "08/11/2023", sexbov: "F", causen: "A", numeip: "8220012354", nomeip: "SALADE", tramip: "79", copami: "FR", copaip: "FR", nupere: "6415300087", estGenisse: false, boucleFaite: true },
      { nutrav: "4463", nunati: "FR8235474463", nobovi: "MERINGUE", danais: "09/12/2016", sexbov: "F", causen: "N", numeip: "8235361007", nomeip: "PAQUES", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "4465", nunati: "FR8223014465", nobovi: "ULINE", danais: "12/12/2023", sexbov: "F", causen: "A", numeip: "8218010334", nomeip: "OVICE", tramip: "79", copami: "FR", copaip: "FR", nupere: "2226701938", estGenisse: false, boucleFaite: true },
      { nutrav: "4791", nunati: "FR8235394791", nobovi: "EVE", danais: "13/03/2012", sexbov: "F", causen: "N", numeip: "8208015764", nomeip: "5764", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "5421", nunati: "FR6505715421", nobovi: null, danais: "23/02/2019", sexbov: "F", causen: "A", numeip: "6505616382", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "5441", nunati: "FR6505715441", nobovi: null, danais: "30/04/2019", sexbov: "F", causen: "A", numeip: "6505616371", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "5458", nunati: "FR6505715458", nobovi: null, danais: "14/06/2019", sexbov: "F", causen: "A", numeip: "6505472446", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "5482", nunati: "FR4635275482", nobovi: "ZEUS", danais: "10/12/2017", sexbov: "M", causen: "A", numeip: "1205281128", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "5517", nunati: "FR8235565517", nobovi: "TAITOI", danais: "08/11/2022", sexbov: "F", causen: "A", numeip: "8219013327", nomeip: "RAMA", tramip: "79", copami: "FR", copaip: "FR", nupere: "3100361906", estGenisse: false, boucleFaite: true },
      { nutrav: "5520", nunati: "FR8235565520", nobovi: "TALIA", danais: "08/11/2022", sexbov: "F", causen: "A", numeip: "8219013330", nomeip: "RAGEUSE", tramip: "79", copami: "FR", copaip: "FR", nupere: "3100361906", estGenisse: false, boucleFaite: true },
      { nutrav: "5536", nunati: "FR8235565536", nobovi: "TALIA", danais: "16/12/2022", sexbov: "F", causen: "N", numeip: "8235493890", nomeip: "OASIS", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "5716", nunati: "FR8235515716", nobovi: "PAQUERETTE", danais: "16/12/2019", sexbov: "F", causen: "N", numeip: "8235350260", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "5717", nunati: "FR8235515717", nobovi: "PALUCHE", danais: "21/12/2019", sexbov: "F", causen: "N", numeip: "8235351870", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "5718", nunati: "FR8235515718", nobovi: "PASIPHAE", danais: "22/12/2019", sexbov: "F", causen: "N", numeip: "8235288034", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "5801", nunati: "FR4635275801", nobovi: "MICKEY", danais: "15/09/2021", sexbov: "M", causen: "A", numeip: "1216428388", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "6101", nunati: "FR8235436101", nobovi: "LARA CROFT", danais: "08/01/2015", sexbov: "F", causen: "A", numeip: "8235313229", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "6362", nunati: "FR8235506362", nobovi: "OCTAVIE", danais: "27/06/2018", sexbov: "F", causen: "N", numeip: "8208015764", nomeip: "5764", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "6375", nunati: "FR6505616375", nobovi: "DAISY", danais: "15/03/2016", sexbov: "F", causen: "A", numeip: "6503827813", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "6377", nunati: "FR8235506377", nobovi: "OLYMPE", danais: "07/10/2018", sexbov: "F", causen: "N", numeip: "8235361003", nomeip: "FANNY", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "6393", nunati: "FR6505616393", nobovi: null, danais: "31/05/2016", sexbov: "F", causen: "A", numeip: "6503827810", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7284", nunati: "FR3100317284", nobovi: "DAROLES", danais: "05/12/2017", sexbov: "F", causen: "A", numeip: "3100285943", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7290", nunati: "FR3100317290", nobovi: null, danais: "31/12/2017", sexbov: "F", causen: "A", numeip: "3100323637", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7482", nunati: "FR3100327482", nobovi: null, danais: "13/12/2017", sexbov: "F", causen: "A", numeip: "3100334715", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7483", nunati: "FR8235607483", nobovi: "BRIGITTE", danais: "04/02/2026", sexbov: "F", causen: "N", numeip: "8235515716", nomeip: "PAQUERETTE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "7484", nunati: "FR8235607484", nobovi: "BANANE", danais: "21/02/2026", sexbov: "M", causen: "N", numeip: "8235464421", nomeip: "MIRABELLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7485", nunati: "FR8235607485", nobovi: "BANOUFEE", danais: "23/02/2026", sexbov: "F", causen: "N", numeip: "8235529328", nomeip: "SALSA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "7486", nunati: "FR8235607486", nobovi: "BELLE", danais: "10/03/2026", sexbov: "F", causen: "N", numeip: "1220153257", nomeip: "REMISE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "7487", nunati: "FR8235607487", nobovi: "BADBOY", danais: "15/03/2026", sexbov: "M", causen: "N", numeip: "8235571333", nomeip: "UGUETTE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7488", nunati: "FR8235607488", nobovi: "CHANDARY", danais: "24/03/2026", sexbov: "F", causen: "N", numeip: "8235571357", nomeip: "ULLY", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "7489", nunati: "FR8235607489", nobovi: "BENGAL", danais: "24/03/2026", sexbov: "M", causen: "N", numeip: "8235557960", nomeip: "TIGER", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7490", nunati: "FR8235607490", nobovi: "BAHIA", danais: "20/04/2026", sexbov: "F", causen: "N", numeip: "8160070568", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "7491", nunati: "FR8235607491", nobovi: "BOUCHON", danais: "04/05/2026", sexbov: "M", causen: "N", numeip: "1220153235", nomeip: "RATATINE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7492", nunati: "FR8235607492", nobovi: "BRUNONO", danais: "10/05/2026", sexbov: "M", causen: "N", numeip: "1220153281", nomeip: "REINETTE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7493", nunati: "FR8235607493", nobovi: "BOUTON DOR", danais: "15/05/2026", sexbov: "F", causen: "N", numeip: "8160070592", nomeip: "HERBE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "7505", nunati: "FR8235607505", nobovi: "BETTRAVE", danais: "04/02/2026", sexbov: "M", causen: "N", numeip: "8235543543", nomeip: "SYNDICALE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7923", nunati: "FR8235557923", nobovi: "TAGLIATEL", danais: "13/01/2022", sexbov: "F", causen: "N", numeip: "3210932659", nomeip: "VERY OLD", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7926", nunati: "FR8235557926", nobovi: "TEQUILA", danais: "17/01/2022", sexbov: "F", causen: "N", numeip: "8235409559", nomeip: "ISIS", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7959", nunati: "FR8235557959", nobovi: "ANGELINA", danais: "24/09/2022", sexbov: "F", causen: "N", numeip: "8235436101", nomeip: "LARA CROFT", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7960", nunati: "FR8235557960", nobovi: "TIGER", danais: "24/09/2022", sexbov: "F", causen: "N", numeip: "8235409540", nomeip: "SAUTERELLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7963", nunati: "FR8235557963", nobovi: "TEMPETE", danais: "18/10/2022", sexbov: "F", causen: "N", numeip: "8235361007", nomeip: "PAQUES", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "7968", nunati: "FR8235557968", nobovi: "TAYA", danais: "20/11/2022", sexbov: "F", causen: "N", numeip: "8235464425", nomeip: "MARELLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9212", nunati: "FR8235599212", nobovi: "AZUR", danais: "28/08/2025", sexbov: "M", causen: "N", numeip: "3100317284", nomeip: "DAROLES", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9213", nunati: "FR8235599213", nobovi: "ARNICA", danais: "28/08/2025", sexbov: "F", causen: "N", numeip: "8235444143", nomeip: "LAVANDE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9214", nunati: "FR8235599214", nobovi: "AMETHYSTE", danais: "28/08/2025", sexbov: "F", causen: "N", numeip: "3100317290", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9215", nunati: "FR8235599215", nobovi: "ACOLYTE", danais: "11/09/2025", sexbov: "M", causen: "N", numeip: "8160070588", nomeip: "MINNIE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9216", nunati: "FR8235599216", nobovi: "ALBA", danais: "11/09/2025", sexbov: "F", causen: "N", numeip: "8235543535", nomeip: "SHADOW", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9217", nunati: "FR8235599217", nobovi: "AMBRE", danais: "14/09/2025", sexbov: "F", causen: "N", numeip: "6505715441", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9218", nunati: "FR8235599218", nobovi: "ABSOL", danais: "20/09/2025", sexbov: "M", causen: "N", numeip: "8235361003", nomeip: "FANNY", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9219", nunati: "FR8235599219", nobovi: "AUDACE", danais: "21/09/2025", sexbov: "F", causen: "N", numeip: "8235529323", nomeip: "COURAGEUSE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9220", nunati: "FR8235599220", nobovi: "ARROW", danais: "21/09/2025", sexbov: "M", causen: "N", numeip: "3210932659", nomeip: "VERY OLD", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9221", nunati: "FR8235599221", nobovi: "AMAZONE", danais: "23/09/2025", sexbov: "F", causen: "N", numeip: "3100327482", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9222", nunati: "FR8235599222", nobovi: "ACHILLEE", danais: "24/09/2025", sexbov: "F", causen: "N", numeip: "8235506362", nomeip: "OCTAVIE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9223", nunati: "FR8235599223", nobovi: "ARCKO", danais: "04/10/2025", sexbov: "M", causen: "N", numeip: "8235409558", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9224", nunati: "FR8235599224", nobovi: "ADAM", danais: "07/10/2025", sexbov: "M", causen: "N", numeip: "6505616375", nomeip: "DAISY", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9225", nunati: "FR8235599225", nobovi: "ALIBI", danais: "07/10/2025", sexbov: "M", causen: "N", numeip: "6505715458", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9226", nunati: "FR8235599226", nobovi: "ADMIRABLE", danais: "15/10/2025", sexbov: "F", causen: "N", numeip: "8235464428", nomeip: "MALICE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9227", nunati: "FR8235599227", nobovi: "ADAGIO", danais: "21/10/2025", sexbov: "M", causen: "N", numeip: "8235506377", nomeip: "OLYMPE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9228", nunati: "FR8235599228", nobovi: "ATLANTA", danais: "23/10/2025", sexbov: "F", causen: "N", numeip: "8235529326", nomeip: "RIHANNA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9230", nunati: "FR8235599230", nobovi: "ANAGRAMME", danais: "02/11/2025", sexbov: "M", causen: "N", numeip: "8235557968", nomeip: "TAYA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9232", nunati: "FR8235599232", nobovi: "ANATOLE", danais: "07/11/2025", sexbov: "M", causen: "N", numeip: "8160070555", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9233", nunati: "FR8235599233", nobovi: "ALBERTINE", danais: "07/11/2025", sexbov: "F", causen: "N", numeip: "8235565517", nomeip: "TAITOI", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9234", nunati: "FR8235599234", nobovi: "ANSELME", danais: "08/11/2025", sexbov: "M", causen: "N", numeip: "8235373753", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9236", nunati: "FR8235599236", nobovi: "ALADDIN", danais: "10/11/2025", sexbov: "M", causen: "N", numeip: "8235571331", nomeip: "TAMARIS", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9237", nunati: "FR8235599237", nobovi: "ARIANE", danais: "12/11/2025", sexbov: "F", causen: "N", numeip: "8235543540", nomeip: "SISTER", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9238", nunati: "FR8235599238", nobovi: "ALMA", danais: "13/11/2025", sexbov: "F", causen: "N", numeip: "6505715421", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9239", nunati: "FR8235599239", nobovi: "AZALEE", danais: "13/11/2025", sexbov: "F", causen: "N", numeip: "8235529318", nomeip: "REBELLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9240", nunati: "FR8235599240", nobovi: "ANIS", danais: "16/11/2025", sexbov: "M", causen: "N", numeip: "8235554286", nomeip: "SABA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9241", nunati: "FR8235599241", nobovi: "ARRYPOTTER", danais: "19/11/2025", sexbov: "M", causen: "N", numeip: "8235474442", nomeip: "MARELLE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9242", nunati: "FR8235599242", nobovi: "ALTO", danais: "20/11/2025", sexbov: "M", causen: "N", numeip: "8235565536", nomeip: "TALIA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9243", nunati: "FR8235599243", nobovi: "ACHILLE", danais: "20/11/2025", sexbov: "M", causen: "N", numeip: "8235529321", nomeip: "PUYLAROQUE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9244", nunati: "FR8235599244", nobovi: "APOLLINE", danais: "23/11/2025", sexbov: "F", causen: "N", numeip: "8235557959", nomeip: "ANGELINA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9246", nunati: "FR8235599246", nobovi: "ALIX", danais: "01/12/2025", sexbov: "F", causen: "N", numeip: "8235557923", nomeip: "TAGLIATEL", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9247", nunati: "FR8235599247", nobovi: "ACAPELLA", danais: "04/12/2025", sexbov: "F", causen: "N", numeip: "8235543533", nomeip: "SHAKIRA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9248", nunati: "FR8235599248", nobovi: "ARCHIMEDE", danais: "08/12/2025", sexbov: "M", causen: "N", numeip: "8235529327", nomeip: "RIGOLOTE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9249", nunati: "FR8235599249", nobovi: "APPLE", danais: "08/12/2025", sexbov: "F", causen: "N", numeip: "8235474463", nomeip: "MERINGUE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9251", nunati: "FR8235599251", nobovi: "ARLETTE", danais: "10/12/2025", sexbov: "F", causen: "N", numeip: "8222010655", nomeip: "TABA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9252", nunati: "FR8235599252", nobovi: "ARENA", danais: "10/12/2025", sexbov: "F", causen: "N", numeip: "8235543542", nomeip: "SIXTINE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9253", nunati: "FR8235599253", nobovi: "AMOUREUSE", danais: "13/12/2025", sexbov: "F", causen: "N", numeip: "8235557926", nomeip: "TEQUILA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9254", nunati: "FR8235599254", nobovi: "ALEXANDRA", danais: "12/12/2025", sexbov: "F", causen: "N", numeip: "8235409559", nomeip: "ISIS", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9255", nunati: "FR8235599255", nobovi: "ADONIS", danais: "12/12/2025", sexbov: "F", causen: "N", numeip: "8235529278", nomeip: "SABA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9256", nunati: "FR8235599256", nobovi: "ANYA", danais: "14/12/2025", sexbov: "F", causen: "N", numeip: "8235565520", nomeip: "TALIA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9258", nunati: "FR8235599258", nobovi: "ACROBATE", danais: "22/12/2025", sexbov: "M", causen: "N", numeip: "8235474451", nomeip: "TOTOSSE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9259", nunati: "FR8235599259", nobovi: "BERNARNO", danais: "03/01/2026", sexbov: "M", causen: "N", numeip: "8235430777", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9260", nunati: "FR8235599260", nobovi: "BLIZAREINE", danais: "21/01/2026", sexbov: "F", causen: "N", numeip: "6505616393", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9261", nunati: "FR8235599261", nobovi: "BULBIZARRE", danais: "22/01/2026", sexbov: "M", causen: "N", numeip: "8235557963", nomeip: "TEMPETE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9262", nunati: "FR8235599262", nobovi: "BETISE", danais: "03/02/2026", sexbov: "F", causen: "N", numeip: "8235515717", nomeip: "PALUCHE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9278", nunati: "FR8235529278", nobovi: "SABA", danais: "07/10/2021", sexbov: "F", causen: "A", numeip: "8218014707", nomeip: "OSEILLE", tramip: "79", copami: "FR", copaip: "FR", nupere: "3100361906", estGenisse: false, boucleFaite: true },
      { nutrav: "9317", nunati: "FR8235529317", nobovi: "REVEUSE", danais: "25/11/2020", sexbov: "F", causen: "N", numeip: "8235436101", nomeip: "LARA CROFT", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9318", nunati: "FR8235529318", nobovi: "REBELLE", danais: "28/11/2020", sexbov: "F", causen: "N", numeip: "8235394803", nomeip: "BIANCA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9321", nunati: "FR8235529321", nobovi: "PUYLAROQUE", danais: "13/12/2020", sexbov: "F", causen: "N", numeip: "8235455119", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9323", nunati: "FR8235529323", nobovi: "COURAGEUSE", danais: "18/12/2020", sexbov: "F", causen: "N", numeip: "8235350260", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9326", nunati: "FR8235529326", nobovi: "RIHANNA", danais: "27/12/2020", sexbov: "F", causen: "N", numeip: "4632709228", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9327", nunati: "FR8235529327", nobovi: "RIGOLOTE", danais: "30/12/2020", sexbov: "F", causen: "N", numeip: "8235409559", nomeip: "ISIS", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9328", nunati: "FR8235529328", nobovi: "SALSA", danais: "12/01/2021", sexbov: "F", causen: "N", numeip: "8235474451", nomeip: "TOTOSSE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9559", nunati: "FR8235409559", nobovi: "ISIS", danais: "04/12/2012", sexbov: "F", causen: "N", numeip: "8235195356", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9854", nunati: "FR8235419854", nobovi: null, danais: "04/09/2013", sexbov: "F", causen: "N", numeip: "8235195366", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: false, boucleFaite: true },
      { nutrav: "9855", nunati: "FR8235579855", nobovi: "UBUESQUE", danais: "10/12/2023", sexbov: "F", causen: "N", numeip: "8235409559", nomeip: "ISIS", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9859", nunati: "FR8235579859", nobovi: "ULALA", danais: "20/12/2023", sexbov: "F", causen: "N", numeip: "8235515717", nomeip: "PALUCHE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9864", nunati: "FR8235579864", nobovi: "VENUS", danais: "01/01/2024", sexbov: "F", causen: "N", numeip: "8235506376", nomeip: "OPHELIE", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9865", nunati: "FR8235579865", nobovi: "VICTOIRE", danais: "03/01/2024", sexbov: "F", causen: "N", numeip: "8160070568", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9874", nunati: "FR8235579874", nobovi: "VAHINE", danais: "27/03/2024", sexbov: "F", causen: "N", numeip: "8235493890", nomeip: "OASIS", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9875", nunati: "FR8235579875", nobovi: "VIRGINIE", danais: "02/05/2024", sexbov: "F", causen: "N", numeip: "8235419854", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9876", nunati: "FR8235579876", nobovi: "VILAINE", danais: "16/05/2024", sexbov: "F", causen: "N", numeip: "3100317290", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9879", nunati: "FR8235579879", nobovi: "VENISE", danais: "20/05/2024", sexbov: "F", causen: "N", numeip: "8235444152", nomeip: "LOLA", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9885", nunati: "FR8235579885", nobovi: "VALEUREUSE", danais: "14/06/2024", sexbov: "F", causen: "N", numeip: "8235361003", nomeip: "FANNY", tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
      { nutrav: "9891", nunati: "FR8235579891", nobovi: "VAGABONDE", danais: "03/09/2024", sexbov: "F", causen: "N", numeip: "3100327482", nomeip: null, tramip: "79", copami: "FR", copaip: "FR", nupere: null, estGenisse: true, boucleFaite: true },
    ];

    // Index nunati -> id pour la généalogie et les vélages
    const animalByNunati: Record<string, string> = {};

    for (const a of csvAnimaux) {
      const animal = await prisma.animal.create({
        data: {
          copaip:     a.copaip,
          nunati:     a.nunati,
          nutrav:     a.nutrav.padStart(4, "0"),
          nobovi:     a.nobovi ?? null,
          danais:     d(a.danais),
          sexbov:     a.sexbov,
          statut:     "ACTIF",
          estGenisse: a.estGenisse,
          boucleFaite: a.boucleFaite,
          copami:     a.copami ?? null,
          numeip:     a.numeip ?? null,
          nomeip:     a.nomeip ?? null,
          tramip:     a.tramip ?? null,
          updatedAt:  new Date(),
        },
      });
      // stocker par NUNATI court (sans "FR" préfixe) pour faire le lien avec NUMEIP
      const nunatICourt = a.nunati.slice(2); // retire le "FR"
      animalByNunati[nunatICourt] = animal.id;
    }
    log.push(`✅ ${csvAnimaux.length} animaux créés`);

    // ── ÉVÉNEMENT SANITAIRE vache 777 (métrite) ────────────
    const vache777 = await prisma.animal.findUnique({ where: { nutrav: "777" } });
    if (vache777) {
      await prisma.evenementSanitaire.create({
        data: {
          animalId:    vache777.id,
          type:        "METRITE",
          date:        d("03/01/2026"),
          description: "Métrite post-vélage",
          resolu:      false,
          updatedAt:   new Date(),
        },
      });
      log.push("✅ Événement sanitaire métrite (777)");
    }

    // ── GÉNÉALOGIE MÈRE ────────────────────────────────────
    // Pour chaque animal avec numeip: chercher la mère dans notre DB
    let liensGenealogiques = 0;
    for (const a of csvAnimaux) {
      if (!a.numeip) continue;
      const mereId = animalByNunati[a.numeip];
      if (!mereId) continue;
      await prisma.animal.update({
        where: { nunati: a.nunati },
        data:  { mereId },
      });
      liensGenealogiques++;
    }
    log.push(`✅ ${liensGenealogiques} liens généalogiques mère établis`);

    // ── VÉLAGES (pour CAUSEN=N avec mère dans la DB) ───────
    let nbVelages = 0;
    for (const a of csvAnimaux) {
      if (a.causen !== "N") continue;
      if (!a.numeip) continue;
      const mereId = animalByNunati[a.numeip];
      if (!mereId) continue;
      const veauId = (await prisma.animal.findUnique({ where: { nunati: a.nunati }, select: { id: true } }))!.id;
      await prisma.velage.create({
        data: {
          date:        d(a.danais),
          qualificatif: "NORMAL",
          vacheId:     mereId,
          veauId:      veauId,
          updatedAt:   new Date(),
        },
      });
      nbVelages++;
    }
    log.push(`✅ ${nbVelages} vélages créés`);

    // ── RÉSUMÉ ─────────────────────────────────────────────
    const totalVaches    = await prisma.animal.count({ where: { sexbov: "F", estGenisse: false } });
    const totalGenisses  = await prisma.animal.count({ where: { estGenisse: true } });
    const totalMales     = await prisma.animal.count({ where: { sexbov: "M" } });
    const totalVelages   = await prisma.velage.count();
    const totalAnimaux   = await prisma.animal.count();

    const résumé = {
      animaux:  totalAnimaux,
      vaches:   totalVaches,
      génisses: totalGenisses,
      mâles:    totalMales,
      vélages:  totalVelages,
    };

    log.push("🎉 Seed terminé !");

    return NextResponse.json({ success: true, log, résumé });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.push(`❌ Erreur : ${message}`);
    return NextResponse.json({ success: false, log, error: message }, { status: 500 });
  }
}

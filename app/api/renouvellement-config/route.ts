import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeRenewalSettings, type RenewalSettings } from "@/lib/herd-renewal";

function validateSettings(value: unknown): RenewalSettings | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Partial<RenewalSettings>;
  const targetMothers = Number(body.targetMothers);
  const renewalRatePercent = Number(body.renewalRatePercent);
  const firstCalvingAgeMonths = Number(body.firstCalvingAgeMonths);
  if (!Number.isFinite(targetMothers) || targetMothers < 1 || targetMothers > 10000) return null;
  if (!Number.isFinite(renewalRatePercent) || renewalRatePercent < 0 || renewalRatePercent > 100) return null;
  if (!Number.isFinite(firstCalvingAgeMonths) || firstCalvingAgeMonths < 12 || firstCalvingAgeMonths > 60) return null;
  return {
    targetMothers: Math.round(targetMothers),
    renewalRatePercent,
    firstCalvingAgeMonths: Math.round(firstCalvingAgeMonths),
  };
}

export async function PATCH(request: NextRequest) {
  const settings = validateSettings(await request.json().catch(() => null));
  if (!settings) return NextResponse.json({ error: "Paramètres de renouvellement invalides." }, { status: 400 });

  const current = await prisma.exploitationConfig.findUnique({
    where: { id: "singleton" },
    select: { reproductionRulesJson: true },
  });
  const reproductionRulesJson = mergeRenewalSettings(current?.reproductionRulesJson, settings);
  await prisma.exploitationConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", reproductionRulesJson },
    update: { reproductionRulesJson },
  });
  return NextResponse.json({ settings });
}

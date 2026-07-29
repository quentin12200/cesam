import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/action-log";
import {
  CESAM_REPRODUCTION_RULES,
  applyPostCalvingRestDays,
  getPostCalvingRestDays,
  parseReproductionRules,
  validateReproductionRules,
  type ReproductionRulesConfig,
} from "@/lib/reproduction-rules";

export async function GET() {
  const config = await prisma.exploitationConfig.findUnique({
    where: { id: "singleton" },
    select: { reproductionRulesJson: true, reproReposObjectifJours: true },
  }).catch(() => null);
  return NextResponse.json(
    applyPostCalvingRestDays(
      parseReproductionRules(config?.reproductionRulesJson),
      config?.reproReposObjectifJours
    )
  );
}

export async function PUT(request: NextRequest) {
  const body = await request.json() as { config?: ReproductionRulesConfig; restoreDefaults?: boolean };
  const nextConfig = body.restoreDefaults
    ? parseReproductionRules(JSON.stringify(CESAM_REPRODUCTION_RULES))
    : parseReproductionRules(JSON.stringify(body.config ?? {}));
  const validation = validateReproductionRules(nextConfig);
  if (validation.errors.length > 0) {
    return NextResponse.json({ error: validation.errors[0], errors: validation.errors, warnings: validation.warnings }, { status: 400 });
  }

  const previous = await prisma.exploitationConfig.findUnique({
    where: { id: "singleton" },
    select: { reproductionRulesJson: true },
  }).catch(() => null);
  const postCalvingRestDays = getPostCalvingRestDays(nextConfig);
  const synchronizedConfig = applyPostCalvingRestDays(nextConfig, postCalvingRestDays);
  const reproductionRulesJson = JSON.stringify(synchronizedConfig);
  await prisma.exploitationConfig.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", reproductionRulesJson, reproReposObjectifJours: postCalvingRestDays },
    update: { reproductionRulesJson, reproReposObjectifJours: postCalvingRestDays },
  });

  try {
    await logAction(
      "PUT_REPRODUCTION_RULES",
      body.restoreDefaults ? "Règles de reproduction restaurées" : "Règles de reproduction mises à jour",
      { op: "update", model: "exploitationConfig", where: { id: "singleton" }, data: { reproductionRulesJson: previous?.reproductionRulesJson ?? "{}" } }
    );
  } catch {}

  return NextResponse.json({ config: synchronizedConfig, warnings: validation.warnings });
}

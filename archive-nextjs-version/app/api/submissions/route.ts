import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toStorePlanInputs, currentPlanningContext } from "@/lib/planning";
import { computeStorePlan } from "@/lib/otb-engine";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const storeId = typeof body?.storeId === "string" ? body.storeId : null;
  const comment = typeof body?.comment === "string" && body.comment.trim() !== "" ? body.comment.trim() : null;
  if (!storeId) return NextResponse.json({ error: "storeId is required." }, { status: 400 });

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });

  if (session.role !== "admin" && store.ownerId !== session.userId) {
    return NextResponse.json({ error: "You can only submit your own stores." }, { status: 403 });
  }

  const { current, planning1, planning2, horizon } = currentPlanningContext();

  const lock1 = await prisma.seasonLock.findUnique({ where: { seasonLabel: planning1.label } });
  const lock2 = await prisma.seasonLock.findUnique({ where: { seasonLabel: planning2.label } });
  if (session.role !== "admin" && (lock1?.locked || lock2?.locked)) {
    return NextResponse.json({ error: "This season is locked by an admin and can no longer be submitted." }, { status: 423 });
  }

  const planningInput = await prisma.planningInput.findUnique({
    where: { storeId_cycleLabel: { storeId, cycleLabel: current.label } },
  });
  if (!planningInput) {
    return NextResponse.json({ error: "No draft inputs found for this cycle." }, { status: 404 });
  }

  const fxRateRows = await prisma.fxRate.findMany();
  const fxRates: Record<string, number> = {};
  for (const r of fxRateRows) fxRates[r.currency] = r.rateToUsd;

  const plan = computeStorePlan(toStorePlanInputs(planningInput, horizon));

  const lastSubmission = await prisma.submission.findFirst({
    where: { storeId, cycleLabel: current.label },
    orderBy: { version: "desc" },
  });
  const nextVersion = (lastSubmission?.version ?? 0) + 1;

  const submission = await prisma.submission.create({
    data: {
      storeId,
      userId: session.userId,
      cycleLabel: current.label,
      planningSeason1: planning1.label,
      planningSeason2: planning2.label,
      version: nextVersion,
      comment,
      inputsJson: JSON.stringify(planningInput),
      fxRatesJson: JSON.stringify(fxRates),
      outputsJson: JSON.stringify(plan),
    },
  });

  return NextResponse.json({ ok: true, submission });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { parseMonthlyForecast } from "@/lib/planning";

const EDITABLE_NUMBER_FIELDS = [
  "currentOnHandInventory",
  "currentRemainingReceipts",
  "currentDiscountPct",
  "s1SellThroughPct",
  "s1DiscountPct",
  "s1OnOrder",
  "s2SellThroughPct",
  "s2DiscountPct",
  "s2OnOrder",
] as const;

const ADMIN_ONLY_FIELDS = ["s1ManualSosOverride", "s2ManualSosOverride"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { storeId } = await params;
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) return NextResponse.json({ error: "Store not found" }, { status: 404 });

  if (session.role !== "admin" && store.ownerId !== session.userId) {
    return NextResponse.json({ error: "You can only edit your own stores." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const cycleLabel = typeof body.cycleLabel === "string" ? body.cycleLabel : null;
  if (!cycleLabel) {
    return NextResponse.json({ error: "cycleLabel is required." }, { status: 400 });
  }

  const existing = await prisma.planningInput.findUnique({
    where: { storeId_cycleLabel: { storeId, cycleLabel } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Planning input row not found for this cycle." }, { status: 404 });
  }

  if (existing.isLocked && session.role !== "admin") {
    return NextResponse.json({ error: "This season is locked by an admin and can no longer be edited." }, { status: 423 });
  }

  const data: Record<string, number | string> = {};

  for (const field of EDITABLE_NUMBER_FIELDS) {
    if (field in body) {
      const value = Number(body[field]);
      if (Number.isFinite(value)) data[field] = value;
    }
  }

  if (session.role === "admin") {
    for (const field of ADMIN_ONLY_FIELDS) {
      if (field in body) {
        const raw = body[field];
        data[field as string] = raw === null || raw === "" ? (null as unknown as number) : Number(raw);
      }
    }
  }

  if (body.monthlyForecastPatch && typeof body.monthlyForecastPatch === "object") {
    const current = parseMonthlyForecast(existing.monthlyForecastJson);
    for (const [monthKey, value] of Object.entries(body.monthlyForecastPatch)) {
      const num = Number(value);
      if (Number.isFinite(num)) current[monthKey] = num;
    }
    data.monthlyForecastJson = JSON.stringify(current);
  }

  const updated = await prisma.planningInput.update({
    where: { storeId_cycleLabel: { storeId, cycleLabel } },
    data,
  });

  return NextResponse.json({ ok: true, planningInput: updated });
}

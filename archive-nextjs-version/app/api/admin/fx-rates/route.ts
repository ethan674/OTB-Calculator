import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const currency = typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : "";
  const rateToUsd = Number(body?.rateToUsd);
  const asOfDate = typeof body?.asOfDate === "string" ? new Date(body.asOfDate) : new Date();

  if (!currency || !Number.isFinite(rateToUsd) || rateToUsd <= 0) {
    return NextResponse.json({ error: "A valid currency code and positive rateToUsd are required." }, { status: 400 });
  }

  const rate = await prisma.fxRate.upsert({
    where: { currency },
    update: { rateToUsd, asOfDate },
    create: { currency, rateToUsd, asOfDate },
  });

  return NextResponse.json({ ok: true, rate });
}

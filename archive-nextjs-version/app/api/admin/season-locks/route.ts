import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const seasonLabel = typeof body?.seasonLabel === "string" ? body.seasonLabel : null;
  const locked = typeof body?.locked === "boolean" ? body.locked : null;
  if (!seasonLabel || locked === null) {
    return NextResponse.json({ error: "seasonLabel and locked are required." }, { status: 400 });
  }

  const lock = await prisma.seasonLock.upsert({
    where: { seasonLabel },
    update: { locked, lockedAt: locked ? new Date() : null },
    create: { seasonLabel, locked, lockedAt: locked ? new Date() : null },
  });

  return NextResponse.json({ ok: true, lock });
}

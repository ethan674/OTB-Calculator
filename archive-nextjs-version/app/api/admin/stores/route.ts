import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { Channel } from "@prisma/client";

const CHANNELS: Channel[] = ["Retail", "EC", "Wholesale", "Outlet"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const storeCode = typeof body?.storeCode === "string" ? body.storeCode.trim() : "";
  const storeName = typeof body?.storeName === "string" ? body.storeName.trim() : "";
  const brand = typeof body?.brand === "string" ? body.brand.trim() : "";
  const channel = typeof body?.channel === "string" ? body.channel : "";
  const market = typeof body?.market === "string" ? body.market.trim() : "";
  const currency = typeof body?.currency === "string" ? body.currency.trim().toUpperCase() : "";
  const ownerId = typeof body?.ownerId === "string" && body.ownerId !== "" ? body.ownerId : null;

  if (!storeCode || !storeName || !brand || !market || !currency || !CHANNELS.includes(channel as Channel)) {
    return NextResponse.json({ error: "storeCode, storeName, brand, market, currency and a valid channel are required." }, { status: 400 });
  }

  try {
    const store = await prisma.store.create({
      data: { storeCode, storeName, brand, channel: channel as Channel, market, currency, ownerId, active: true },
    });
    return NextResponse.json({ ok: true, store });
  } catch {
    return NextResponse.json({ error: "A store with that code already exists." }, { status: 409 });
  }
}

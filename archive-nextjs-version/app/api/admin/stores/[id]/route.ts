import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { Channel } from "@prisma/client";

const CHANNELS: Channel[] = ["Retail", "EC", "Wholesale", "Outlet"];
const EDITABLE_STRING_FIELDS = ["storeCode", "storeName", "brand", "market", "currency"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid body." }, { status: 400 });

  const data: Record<string, string | boolean | null> = {};
  for (const field of EDITABLE_STRING_FIELDS) {
    if (field in body && typeof body[field] === "string") {
      data[field] = field === "currency" ? body[field].trim().toUpperCase() : body[field].trim();
    }
  }
  if ("channel" in body && CHANNELS.includes(body.channel)) data.channel = body.channel;
  if ("active" in body && typeof body.active === "boolean") data.active = body.active;
  if ("ownerId" in body && (typeof body.ownerId === "string" || body.ownerId === null)) {
    data.ownerId = body.ownerId === "" ? null : body.ownerId;
  }

  try {
    const store = await prisma.store.update({ where: { id }, data });
    return NextResponse.json({ ok: true, store });
  } catch {
    return NextResponse.json({ error: "Failed to update store." }, { status: 400 });
  }
}

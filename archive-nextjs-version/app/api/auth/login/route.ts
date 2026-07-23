import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkTeamPassword, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!name || !password) {
    return NextResponse.json({ error: "Name and password are required." }, { status: 400 });
  }

  if (!checkTeamPassword(password)) {
    return NextResponse.json({ error: "Incorrect team password." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { name } });
  if (!user) {
    return NextResponse.json({ error: "No user found with that name. Ask an admin to create your account." }, { status: 401 });
  }

  await setSessionCookie({ userId: user.id, name: user.name, role: user.role });

  return NextResponse.json({ ok: true, role: user.role });
}

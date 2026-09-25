import { NextResponse } from "next/server";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/session";

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  const validEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const validPassword = process.env.ADMIN_PASSWORD || "";
  const secret = process.env.SESSION_SECRET;

  if (!validEmail || !validPassword || !secret) {
    return NextResponse.json(
      { error: "Server is missing ADMIN_EMAIL / ADMIN_PASSWORD / SESSION_SECRET in .env.local" },
      { status: 500 }
    );
  }

  if (email !== validEmail || password !== validPassword) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const token = createSessionToken(
    { admin: true, exp: Date.now() + SESSION_MAX_AGE_MS },
    secret
  );

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000
  });
  return res;
}

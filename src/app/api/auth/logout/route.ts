import { NextResponse } from "next/server";
import { ACTIVE_BUSINESS_COOKIE, APP_SESSION_COOKIE } from "@/lib/app-session-shared";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const rawToken =
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${APP_SESSION_COOKIE}=`))
      ?.slice(`${APP_SESSION_COOKIE}=`.length) ?? "";

  const res = NextResponse.json({ ok: true });
  res.cookies.set(APP_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  res.cookies.set(ACTIVE_BUSINESS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

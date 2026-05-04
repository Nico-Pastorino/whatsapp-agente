import { NextResponse } from "next/server";
import { COOKIE_NAME, redactToken } from "@/lib/auth-shared";

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const rawToken =
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))
      ?.slice(`${COOKIE_NAME}=`.length) ?? "";

  console.log("[auth/logout] cookie present:", !!rawToken);
  if (rawToken) {
    console.log("[auth/logout] cookie preview:", redactToken(rawToken));
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

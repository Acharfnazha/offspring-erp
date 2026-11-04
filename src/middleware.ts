import { NextResponse, type NextRequest } from "next/server";

const PUBLIC = ["/login", "/forgot-password", "/reset-password", "/api/health", "/icon.svg"];

/** Edge gate: unauthenticated requests are redirected to /login. Full session validation & authorization happen server-side. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/")) || pathname.startsWith("/_next")) return NextResponse.next();
  if (!req.cookies.get("ofs_session")?.value) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };

import { NextResponse, type NextRequest } from "next/server";
import { bookmarkClientAccess } from "@/app/lib/bookmarks/client-auth";

export function proxy(_request: NextRequest) {
  if (bookmarkClientAccess() === "authorized") return NextResponse.next();

  return new NextResponse("Bookmark access is not configured.", {
    status: 503,
    headers: { "Cache-Control": "no-store" }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"]
};

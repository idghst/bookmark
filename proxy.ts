import { NextResponse, type NextRequest } from "next/server";
import {
  bookmarkAuthenticationHeaders,
  bookmarkClientAccess
} from "@/app/lib/bookmarks/client-auth";

export function proxy(request: NextRequest) {
  const access = bookmarkClientAccess(request);
  if (access === "authorized") return NextResponse.next();

  if (access === "configuration_missing") {
    return new NextResponse("Bookmark access is not configured.", {
      status: 503,
      headers: { "Cache-Control": "no-store" }
    });
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: bookmarkAuthenticationHeaders()
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest).*)"]
};

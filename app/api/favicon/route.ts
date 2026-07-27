import { type NextRequest } from "next/server";

const CACHE_HEADERS = {
  "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000"
};

function parseHttpUrl(value: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function faviconUrl(origin: string, size: string) {
  const url = new URL("https://www.google.com/s2/favicons");
  url.searchParams.set("domain_url", origin);
  url.searchParams.set("sz", size);
  return url;
}

export async function GET(request: NextRequest) {
  const target = parseHttpUrl(request.nextUrl.searchParams.get("url"));
  if (!target) return new Response(null, { status: 204, headers: CACHE_HEADERS });

  const size = request.nextUrl.searchParams.get("size") ?? "32";
  const upstream = await fetch(faviconUrl(target.origin, size), { cache: "force-cache" });
  const contentType = upstream.headers.get("content-type");
  if (!upstream.ok || !contentType?.startsWith("image/")) {
    return new Response(null, { status: 204, headers: CACHE_HEADERS });
  }

  return new Response(await upstream.arrayBuffer(), {
    headers: { ...CACHE_HEADERS, "Content-Type": contentType }
  });
}

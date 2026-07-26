export type SupabaseServerConfig = {
  url: string;
  apiKey: string;
  authorization: string | null;
};

function isBrowserSafeKey(apiKey: string) {
  if (apiKey.startsWith("sb_publishable_")) return true;

  const payload = apiKey.split(".")[1];
  if (!payload) return false;

  try {
    const encoded = payload.replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(
      atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="))
    ) as { role?: string };
    return claims.role === "anon" || claims.role === "authenticated";
  } catch {
    return false;
  }
}

export function getSupabaseServerConfig(): SupabaseServerConfig | null {
  const url = (
    process.env.BOOKMARK_SUPABASE_URL ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.replace(/\/$/, "");
  const apiKey =
    process.env.BOOKMARK_SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.BOOKMARK_SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !apiKey || isBrowserSafeKey(apiKey)) return null;

  return {
    url,
    apiKey,
    authorization: apiKey.startsWith("sb_secret_") ? null : `Bearer ${apiKey}`
  };
}

export function createSupabaseRestHeaders(
  config: SupabaseServerConfig,
  {
    schema,
    write,
    prefer
  }: {
    schema: string;
    write: boolean;
    prefer?: string;
  }
) {
  const headers = new Headers({ apikey: config.apiKey });
  if (config.authorization) headers.set("Authorization", config.authorization);
  headers.set(write ? "Content-Profile" : "Accept-Profile", schema);
  if (prefer) headers.set("Prefer", prefer);
  return headers;
}

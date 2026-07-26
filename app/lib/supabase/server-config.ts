export type SupabaseServerConfig = {
  url: string;
  apiKey: string;
  authorization: string | null;
};

function isAllowedServerKey(apiKey: string) {
  if (apiKey.startsWith("sb_secret_")) return true;

  const parts = apiKey.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) return false;

  try {
    const encoded = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(
      atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, "="))
    ) as { role?: string };
    return claims.role === "service_role";
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

  if (!url || !apiKey || !isAllowedServerKey(apiKey)) return null;

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

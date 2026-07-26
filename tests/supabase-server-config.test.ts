import { afterEach, describe, expect, it, vi } from "vitest";

describe("Supabase server REST config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses an opaque secret without an Authorization header", async () => {
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com/");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_secret_test");
    const { createSupabaseRestHeaders, getSupabaseServerConfig } = await import(
      "@/app/lib/supabase/server-config"
    );
    const config = getSupabaseServerConfig();

    expect(config).toEqual({
      url: "https://db.example.com",
      apiKey: "sb_secret_test",
      authorization: null
    });

    const headers = createSupabaseRestHeaders(config!, {
      schema: "bookmark",
      write: false
    });
    expect(headers.get("apikey")).toBe("sb_secret_test");
    expect(headers.has("Authorization")).toBe(false);
    expect(headers.get("Accept-Profile")).toBe("bookmark");
  });

  it("keeps bearer auth for a legacy service-role JWT", async () => {
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    const serviceRoleJwt =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature";
    vi.stubEnv("BOOKMARK_SUPABASE_SERVICE_ROLE_KEY", serviceRoleJwt);
    const { createSupabaseRestHeaders, getSupabaseServerConfig } = await import(
      "@/app/lib/supabase/server-config"
    );
    const config = getSupabaseServerConfig();
    const headers = createSupabaseRestHeaders(config!, {
      schema: "bookmark",
      write: true,
      prefer: "return=representation"
    });

    expect(headers.get("Authorization")).toBe(`Bearer ${serviceRoleJwt}`);
    expect(headers.get("Content-Profile")).toBe("bookmark");
    expect(headers.get("Prefer")).toBe("return=representation");
  });

  it("does not accept anon or publishable keys as server credentials", async () => {
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_ANON_KEY", "anon-key");
    vi.stubEnv("BOOKMARK_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    const { getSupabaseServerConfig } = await import(
      "@/app/lib/supabase/server-config"
    );

    expect(getSupabaseServerConfig()).toBeNull();
  });

  it("rejects a publishable key supplied through the server secret variable", async () => {
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", "sb_publishable_test");
    const { getSupabaseServerConfig } = await import(
      "@/app/lib/supabase/server-config"
    );

    expect(getSupabaseServerConfig()).toBeNull();
  });

  it("rejects an anon JWT supplied through the server secret variable", async () => {
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    vi.stubEnv(
      "BOOKMARK_SUPABASE_SECRET_KEY",
      "header.eyJyb2xlIjoiYW5vbiJ9.signature"
    );
    const { getSupabaseServerConfig } = await import(
      "@/app/lib/supabase/server-config"
    );

    expect(getSupabaseServerConfig()).toBeNull();
  });

  it("rejects non-service-role values supplied through the server secret variable", async () => {
    vi.stubEnv("BOOKMARK_SUPABASE_URL", "https://db.example.com");
    const { getSupabaseServerConfig } = await import(
      "@/app/lib/supabase/server-config"
    );

    for (const apiKey of [
      "not-a-supabase-key",
      "header.not-base64.signature",
      "header.eyJyb2xlIjoiYXV0aGVudGljYXRlZCJ9.signature"
    ]) {
      vi.stubEnv("BOOKMARK_SUPABASE_SECRET_KEY", apiKey);
      expect(getSupabaseServerConfig()).toBeNull();
    }
  });
});

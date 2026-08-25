import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/favicon/route";

describe("favicon route", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("proxies an image favicon for a valid http URL", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/png" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/favicon?url=https%3A%2F%2Fexample.com%2Fdocs&size=64")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("stale-while-revalidate");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://www.google.com/s2/favicons?domain_url=https%3A%2F%2Fexample.com&sz=64"
    );
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ cache: "force-cache" });
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it("rejects a non-http target without calling upstream", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/favicon?url=javascript%3Aalert%281%29")
    );

    expect(response.status).toBe(204);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns no content for a non-image upstream response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("not an image", {
          status: 200,
          headers: { "Content-Type": "text/html" }
        })
      )
    );

    const response = await GET(
      new NextRequest("http://localhost/api/favicon?url=https%3A%2F%2Fexample.com")
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("clamps oversized favicon requests to the default size", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) =>
      new Response(new Uint8Array([1]), {
        status: 200,
        headers: { "Content-Type": "image/png" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new NextRequest("http://localhost/api/favicon?url=https%3A%2F%2Fexample.com&size=9999")
    );

    expect(response.status).toBe(200);
    expect(String(fetchMock.mock.calls[0][0])).toContain("sz=32");
  });
});

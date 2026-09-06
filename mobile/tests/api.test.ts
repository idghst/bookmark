import { afterEach, expect, it, vi } from "vitest";
import { listBookmarks } from "../src/lib/api";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it("times out while waiting for the response body", async () => {
  vi.useFakeTimers();
  let signal: AbortSignal;
  vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
    signal = init.signal;
    return {
      ok: true, status: 200,
      json: () => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }),
    };
  }));
  const result = listBookmarks({ url: "https://example.test", key: "test" });
  const rejected = expect(result).rejects.toMatchObject({ code: "timeout", status: 0 });
  await vi.advanceTimersByTimeAsync(12000);
  expect(signal!.aborted).toBe(true);
  await rejected;
});

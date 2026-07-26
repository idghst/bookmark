import { describe, expect, it, vi } from "vitest";

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect }));

import HomePage from "@/app/(dashboard)/page";

describe("app entry", () => {
  it("redirects the root route to bookmarks", () => {
    HomePage();
    expect(redirect).toHaveBeenCalledWith("/bookmarks");
  });
});

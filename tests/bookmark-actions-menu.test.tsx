import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookmarkActionsMenu } from "@/app/(dashboard)/bookmarks-ui/BookmarkActionsMenu";
import { toast } from "@/app/components/toast";
import type { BookmarkItem } from "@/app/lib/bookmarks/types";

vi.mock("@/app/components/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

const bookmark: BookmarkItem = {
  id: "bookmark-1", title: "테스트 북마크", url: "https://example.com/path?q=hello",
  description: null, isFavorite: false, folderId: null, position: 0
};
const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");

afterEach(() => {
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
  else Reflect.deleteProperty(navigator, "clipboard");
  vi.clearAllMocks();
});

async function copyLink() {
  const onDuplicate = vi.fn();
  render(<BookmarkActionsMenu bookmark={bookmark} mutationsDisabled={false} onEdit={vi.fn()} onDuplicate={onDuplicate} onDelete={vi.fn()} />);
  fireEvent.keyDown(screen.getByRole("button", { name: "테스트 북마크 메뉴" }), { key: "Enter" });
  fireEvent.click(await screen.findByRole("menuitem", { name: "링크 복사" }));
  return onDuplicate;
}

describe("bookmark link copying", () => {
  it("copies the full URL and reports success without duplicating the bookmark", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    const onDuplicate = await copyLink();

    expect(writeText).toHaveBeenCalledWith(bookmark.url);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("링크를 복사했습니다."));
    expect(onDuplicate).not.toHaveBeenCalled();
  });

  it("reports clipboard permission failures", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });

    await copyLink();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("링크를 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인하세요."));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("reports when the browser has no clipboard API", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });

    await copyLink();

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
  });
});

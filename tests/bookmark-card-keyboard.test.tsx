import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookmarkCard } from "@/app/(dashboard)/bookmarks-ui/BookmarkCard";
import type { BookmarkItem } from "@/app/lib/bookmarks/types";

const bookmark: BookmarkItem = {
  id: "bookmark-1",
  title: "테스트 북마크",
  url: "https://example.com",
  description: null,
  isFavorite: false,
  folderId: null,
  position: 0
};

afterEach(() => vi.restoreAllMocks());

describe("BookmarkCard keyboard actions", () => {
  it("opens the bookmark when Enter is pressed on the card", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    renderCard();

    fireEvent.keyDown(screen.getByRole("link"), { key: "Enter" });

    expect(open).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledWith(bookmark.url, "_blank", "noopener,noreferrer");
  });

  it("does not open the bookmark when Enter is pressed on its favorite button", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const onToggleFavorite = vi.fn();
    renderCard(onToggleFavorite);

    const favorite = screen.getByRole("button", { name: "테스트 북마크 즐겨찾기" });
    fireEvent.keyDown(favorite, { key: "Enter" });
    fireEvent.click(favorite);

    expect(onToggleFavorite).toHaveBeenCalledWith(bookmark.id);
    expect(open).not.toHaveBeenCalled();
  });
});

function renderCard(onToggleFavorite = vi.fn()) {
  render(
    <BookmarkCard
      bookmark={bookmark}
      dragging={false}
      dropEdge={null}
      canDrop={false}
      mutationsDisabled={false}
      onDragStart={vi.fn()}
      onDragEnd={vi.fn()}
      onDragOver={vi.fn()}
      onDrop={vi.fn()}
      onEdit={vi.fn()}
      onDuplicate={vi.fn()}
      onDelete={vi.fn()}
      onToggleFavorite={onToggleFavorite}
    />
  );
}

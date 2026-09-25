import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Modal } from "@/app/(dashboard)/bookmarks-ui/Modal";

function renderModal() {
  const opener = document.createElement("button");
  opener.textContent = "편집 열기";
  document.body.append(opener);
  opener.focus();

  const result = render(
    <Modal title="북마크 편집" onClose={vi.fn()}>
      <form>
        <input aria-label="제목" />
        <button type="button">취소</button>
        <button type="submit">저장</button>
      </form>
    </Modal>
  );

  return { opener, ...result };
}

describe("Modal focus", () => {
  it("focuses the first field and returns focus to the opener when closed", () => {
    const { opener, unmount } = renderModal();

    expect(screen.getByRole("textbox", { name: "제목" })).toHaveFocus();

    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("keeps Tab and Shift+Tab inside the dialog", () => {
    const { opener, unmount } = renderModal();
    const dialog = screen.getByRole("dialog");
    const close = within(dialog).getByRole("button", { name: "닫기" });
    const save = within(dialog).getByRole("button", { name: "저장" });

    save.focus();
    fireEvent.keyDown(save, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(save).toHaveFocus();

    unmount();
    opener.remove();
  });
});

import { useEffect, useId } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function Modal({
  title,
  children,
  onClose,
  onConfirm,
  closeDisabled = false
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm?: () => void;
  closeDisabled?: boolean;
}) {
  const titleId = useId();
  const modalId = useId();

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const modals = document.querySelectorAll<HTMLElement>("[data-bookmark-modal]");
      const topmostModal = modals.item(modals.length - 1);
      if (event.defaultPrevented || topmostModal?.dataset.bookmarkModal !== modalId) return;

      if (event.key === "Escape" && !closeDisabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
        return;
      }
      if (event.key === "Enter" && onConfirm && !closeDisabled) {
        event.preventDefault();
        event.stopImmediatePropagation();
        onConfirm();
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [closeDisabled, modalId, onClose, onConfirm]);

  return createPortal(
    <div
      data-bookmark-modal={modalId}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="max-h-[calc(100dvh-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-xl sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-lg font-medium tracking-[-0.02em] text-[var(--text-heading)]">
            {title}
          </h2>
          <button type="button" disabled={closeDisabled} className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-40" onClick={onClose}>
            <X className="h-5 w-5" />
            <span className="sr-only">닫기</span>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

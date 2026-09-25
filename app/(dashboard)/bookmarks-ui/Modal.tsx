import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    const firstField = modal?.querySelector<HTMLElement>('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])');
    (firstField ?? modal?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR))?.focus();

    return () => previousFocus?.focus();
  }, []);

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
      ref={modalRef}
      data-bookmark-modal={modalId}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key !== "Tab" || event.defaultPrevented) return;
        const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="max-h-[calc(100dvh-env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-lg border border-border bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg sm:max-h-[calc(100dvh-2rem)] sm:rounded-lg">
        <div className="mb-4 flex items-center gap-3">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">
            {title}
          </h2>
          <Button type="button" variant="ghost" size="icon-sm" disabled={closeDisabled} onClick={onClose}>
            <X />
            <span className="sr-only">닫기</span>
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

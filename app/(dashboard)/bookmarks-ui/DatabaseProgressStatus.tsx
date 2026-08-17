import { LoaderCircle } from "lucide-react";

export function DatabaseProgressStatus({ title }: { title: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg border border-[var(--color-brand)]/30 bg-indigo-50 px-4 py-3">
      <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-[var(--color-brand)]" />
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-[var(--text-heading)]">{title}</p>
        <p className="mt-0.5 text-xs text-[var(--text-muted)]">완료될 때까지 잠시 기다려 주세요.</p>
      </div>
    </div>
  );
}

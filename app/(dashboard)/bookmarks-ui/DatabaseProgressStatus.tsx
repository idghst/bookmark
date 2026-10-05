import { LoaderCircle } from "lucide-react";

export function DatabaseProgressStatus({ title }: { title: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
      <LoaderCircle className="size-5 shrink-0 animate-spin text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">화면에 반영했습니다. 백그라운드에서 저장합니다.</p>
      </div>
    </div>
  );
}

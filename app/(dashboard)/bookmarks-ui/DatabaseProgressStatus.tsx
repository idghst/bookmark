import { LoaderCircle } from "lucide-react";

export function DatabaseProgressStatus({ title }: { title: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 rounded-lg border border-border px-4 py-3">
      <LoaderCircle className="size-5 shrink-0 animate-spin text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">완료될 때까지 잠시 기다려 주세요.</p>
      </div>
    </div>
  );
}

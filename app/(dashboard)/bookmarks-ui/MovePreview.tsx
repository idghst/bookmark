import { ArrowRight, GripVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MovePreviewInfo = {
  title: string;
  from: string;
  to: string;
  placement: string;
  contents?: string;
};

// Overlays never change the drop target's geometry while the pointer is moving.
export function DropPreview({ title, placement, contents, variant = "row", edge }: {
  title: string;
  placement: string;
  contents?: string;
  variant?: "row" | "card" | "section";
  edge?: "before" | "after" | null;
}) {
  return (
    <div
      aria-hidden="true"
      data-move-preview={variant}
      className={cn(
        "pointer-events-none absolute inset-0 z-20 flex flex-col justify-center gap-1 rounded-lg border-2 border-dashed border-primary bg-background/95 px-3 py-1 text-primary shadow-md",
        variant === "card" && "rounded-2xl px-4 py-3",
        edge === "before" && "border-t-4",
        edge === "after" && "border-b-4"
      )}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm font-semibold"><GripVertical className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{title}</span>{variant === "row" ? <span className="max-w-[50%] truncate text-[10px] font-normal text-muted-foreground">{placement}</span> : null}</span>
      {variant !== "row" ? <span className="truncate text-[11px] text-muted-foreground">{placement}</span> : null}
      {contents && variant === "section" ? <span className="truncate text-xs text-muted-foreground">{contents}</span> : null}
    </div>
  );
}

export function MovePreview({ preview, floating = false }: { preview: MovePreviewInfo; floating?: boolean }) {
  return (
    <Card
      role="region"
      aria-label="이동 미리보기"
      size="sm"
      className={cn("pointer-events-none border border-primary/30 shadow-lg", floating && "fixed bottom-4 left-4 right-4 z-[60] mx-auto max-w-md lg:left-auto lg:right-6")}
    >
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-2"><Badge variant="secondary">이동 미리보기</Badge><span className="min-w-0 truncate font-semibold">{preview.title}</span></div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="min-w-0 flex-1 break-words">{preview.from}</span><ArrowRight className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="min-w-0 flex-1 break-words text-foreground">{preview.to}</span></div>
        <p className="text-xs font-medium text-primary">{preview.placement}</p>
        {preview.contents ? <p className="text-xs text-muted-foreground">{preview.contents}</p> : null}
        {floating ? <p className="text-[11px] text-muted-foreground">놓으면 이동 · Esc로 취소</p> : null}
      </CardContent>
    </Card>
  );
}

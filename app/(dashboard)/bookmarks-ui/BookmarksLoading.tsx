import { BOOKMARK_APP_HEADER_CLASS } from "@/app/lib/bookmarks/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function BookmarksLoading() {
  return (
    <div role="status" aria-label="북마크 불러오는 중" className="flex h-full min-h-0 overflow-hidden bg-background">
      <aside aria-hidden="true" className="hidden w-64 shrink-0 flex-col border-r border-border bg-muted/40 lg:flex">
        <div className={cn("flex shrink-0 flex-col justify-center border-b border-border px-4 py-3", BOOKMARK_APP_HEADER_CLASS)}>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-2 h-4 w-32" />
        </div>
        <div className="flex flex-col gap-2 p-3">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-8" />
          ))}
        </div>
        <div className="mt-auto border-t border-border p-4">
          <Skeleton className="h-8" />
        </div>
      </aside>
      <section aria-hidden="true" className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background px-4 md:px-5",
            BOOKMARK_APP_HEADER_CLASS
          )}
        >
          <Skeleton className="hidden h-5 w-28 md:block" />
          <Skeleton className="h-8 min-w-0" />
          <Skeleton className="h-8 w-24" />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-background">
          <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-3 p-[clamp(0.75rem,2vw,2rem)]">
            <Skeleton className="h-12" />
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-40 rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </section>
    </div>
  );
}

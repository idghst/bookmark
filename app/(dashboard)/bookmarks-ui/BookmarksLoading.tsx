import { BOOKMARK_APP_HEADER_CLASS, BOOKMARK_SECTION_HEADER_CLASS } from "@/app/lib/bookmarks/constants";
import { cn } from "@/lib/utils";

export function BookmarksLoading() {
  return (
    <div className="fade-in flex h-full min-h-0 overflow-hidden bg-[var(--surface-canvas)]">
      <aside className="hidden w-[20rem] shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--surface-soft)] xl:w-[22rem] lg:flex">
        <div className={cn("flex shrink-0 flex-col justify-center border-b border-[var(--border-subtle)] px-4 py-3", BOOKMARK_APP_HEADER_CLASS)}>
          <div className="h-5 w-24 rounded bg-[var(--surface-card)]" />
          <div className="mt-2 h-4 w-32 rounded bg-[var(--surface-muted)]" />
        </div>
        <div className="space-y-2 p-3">
          {Array.from({ length: 10 }).map((_, index) => (
            <div key={index} className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-canvas)]" />
          ))}
        </div>
        <div className="mt-auto border-t border-[var(--border-subtle)] p-4">
          <div className="h-12 rounded-lg bg-[var(--surface-muted)]" />
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-canvas)] px-4 md:px-5",
            BOOKMARK_APP_HEADER_CLASS
          )}
        >
          <div className="hidden h-5 w-28 rounded bg-[var(--surface-card)] md:block" />
          <div className="h-9 min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-soft)]" />
          <div className="h-7 w-24 rounded bg-[var(--surface-muted)]" />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-[var(--surface-canvas)]">
          <div className="mx-auto w-full max-w-[1480px] space-y-5 p-4 md:p-6 lg:p-8">
            <div className={BOOKMARK_SECTION_HEADER_CLASS}>
              <span className="h-7 w-1 bg-[var(--color-brand)]" />
              <div className="h-7 w-32 rounded bg-[var(--surface-muted)]" />
              <div className="ml-auto h-7 w-8 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)]" />
            </div>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-[104px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-canvas)]" />
            ))}
          </div>
        </main>
      </section>
    </div>
  );
}

import Link from "next/link";
import { BookmarkX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="fade-in flex min-h-dvh items-center justify-center bg-[var(--surface-canvas)] p-4 sm:p-6">
      <section className="w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-6 py-12 text-center">
        <BookmarkX
          className="mx-auto h-14 w-14 rounded-xl bg-[var(--surface-canvas)] p-3 text-[var(--color-brand)]"
          aria-hidden="true"
        />
        <p className="mt-6 text-sm font-medium text-[var(--color-brand)]">404</p>
        <h1 className="mt-2 text-2xl font-medium tracking-[-0.02em] text-[var(--text-heading)]">
          페이지를 찾을 수 없습니다
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
          요청한 페이지가 없거나 이동되었습니다.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-[var(--color-brand)] px-5 text-sm font-medium text-white transition hover:bg-[var(--color-brand-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]/50"
        >
          북마크로 돌아가기
        </Link>
      </section>
    </main>
  );
}

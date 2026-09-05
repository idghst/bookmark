export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-dvh min-h-0 overflow-hidden bg-background">
      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </section>
    </main>
  );
}

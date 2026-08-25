export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-[var(--text-heading)]">{label}</span>
      {children}
    </label>
  );
}

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 bg-[#faf8f5]">
      <div className="w-10 h-10 border-2 border-[#b8a068] border-t-transparent rounded-full animate-spin" />
      <p className="text-[var(--color-charcoal)] text-sm">Loading…</p>
    </div>
  );
}

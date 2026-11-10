export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading Veyra</p>
      <div className="h-10 w-64 animate-pulse bg-accent-50" />
      <div className="h-48 animate-pulse border-2 border-text-primary bg-accent-50" />
    </div>
  );
}

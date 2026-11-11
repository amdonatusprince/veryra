export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <p className="sr-only">Loading Veyra</p>
      <div className="h-10 w-64 animate-pulse rounded-2lg bg-background-tertiary-default" />
      <div className="h-48 animate-pulse rounded-3xl bg-background-tertiary-default" />
    </div>
  );
}

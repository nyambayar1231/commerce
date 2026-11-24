/** Fallback for the auth pages while the session and search params resolve. */
export function AuthSkeleton() {
  return (
    <section className="container-content py-8 pb-24" aria-hidden="true">
      <div className="mx-auto mt-8 h-96 w-full max-w-md animate-pulse rounded-lg border border-border bg-card" />
    </section>
  );
}

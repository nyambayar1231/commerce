// The CMS page's route-level loading state: the same sized skeleton as the content island's
// fallback in `page.tsx`, shown while the route module itself loads.

export default function Loading() {
  return (
    <div className="container-content py-8 pb-16" aria-hidden="true">
      <div className="h-9 w-2/3 max-w-lg animate-pulse rounded bg-muted" />
      <div className="prose mt-6 space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { getPage } from "@/lib/content/pages";
import { getEnv } from "@/lib/env";
import { RichText } from "@/ui/components/rich-text";

// A CMS page (ARCHITECTURE §10.4, §10.13, §10.14): a synchronous shell, the content resolved in
// its own island. An unknown slug is the Mongolian 404 — decided by `generateMetadata` and by
// the island, never cached as one.

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const [{ slug }, t] = await Promise.all([params, getTranslations("cmsPage")]);
  const page = await getPage(slug);
  if (page === null) notFound();
  return {
    title: page.title,
    description: page.descriptionText || t("description"),
    alternates: { canonical: `${getEnv().storefrontUrl}/pages/${slug}` },
  };
}

export default function CmsPage({ params }: PageProps) {
  return (
    <Suspense fallback={<CmsPageSkeleton />}>
      <CmsPageContent params={params} />
    </Suspense>
  );
}

/** The page itself: its title and its sanitized EditorJS blocks. */
async function CmsPageContent({ params }: PageProps) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (page === null) notFound();

  return (
    <div className="container-content py-8 pb-16">
      <h1 className="text-balance text-h1">{page.title}</h1>
      <RichText blocks={page.content} className="mt-6" />
    </div>
  );
}

/** The island's placeholder: a title line and prose lines, the same container and spacing. */
function CmsPageSkeleton() {
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

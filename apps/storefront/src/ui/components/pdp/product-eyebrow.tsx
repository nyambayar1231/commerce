/** Paper's eyebrow above the product title: the category's name; nothing without a category. */
export function ProductEyebrow({ category }: { category: string | undefined }) {
  if (category === undefined || category === "") return null;
  return (
    <p className="order-1 text-sm font-medium uppercase tracking-wide text-muted-foreground">
      {category}
    </p>
  );
}

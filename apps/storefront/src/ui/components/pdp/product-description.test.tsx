// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ProductDescription } from "./product-description";
import { ProductEyebrow } from "./product-eyebrow";

afterEach(cleanup);

describe("ProductDescription", () => {
  it("renders nothing for an empty description", () => {
    const { container } = render(<ProductDescription title="Тайлбар" blocks={[]} />);
    expect(container.innerHTML).toBe("");
    expect(screen.queryByText("Тайлбар")).toBeNull();
  });

  it("renders an open row that collapses on click", () => {
    render(
      <ProductDescription
        title="Тайлбар"
        blocks={[{ type: "paragraph", html: "Зөөлөн ноолуур" }]}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Тайлбар" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Зөөлөн ноолуур")).toBeTruthy();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    // The text stays in the HTML (crawlers); only the region is collapsed.
    expect(screen.getByText("Зөөлөн ноолуур", { selector: "p" })).toBeTruthy();
  });
});

describe("ProductEyebrow", () => {
  it("shows the category", () => {
    render(<ProductEyebrow category="Ороолт" />);
    expect(screen.getByText("Ороолт")).toBeTruthy();
  });

  it("shows nothing without a category", () => {
    const { container } = render(<ProductEyebrow category={undefined} />);
    expect(container.innerHTML).toBe("");
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import mn from "@/../messages/mn.json";
import { Field } from "./auth-form-parts";

afterEach(cleanup);

function renderField(props: Partial<Parameters<typeof Field>[0]> = {}) {
  return render(
    <NextIntlClientProvider locale="mn" messages={mn}>
      <form>
        <Field name="password" type="password" label={mn.auth.password} {...props} />
      </form>
    </NextIntlClientProvider>,
  );
}

describe("Field", () => {
  it("toggles a password field between password and text", () => {
    renderField();
    const input = screen.getByLabelText(mn.auth.password, { exact: true }) as HTMLInputElement;
    expect(input.type).toBe("password");
    const toggle = screen.getByRole("button", { name: mn.auth.showPassword });
    expect(toggle.getAttribute("type")).toBe("button");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    expect(input.name).toBe("password");
    const hide = screen.getByRole("button", { name: mn.auth.hidePassword });
    expect(hide.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(hide);
    expect(input.type).toBe("password");
  });

  it("has no eye button on a text field", () => {
    renderField({ name: "email", type: "email", label: mn.auth.email, icon: "mail" });
    expect(screen.queryByRole("button")).toBeNull();
  });
});

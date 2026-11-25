// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AddressActionState } from "@/lib/account/types";

vi.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

const { AddressForm } = await import("./address-form");

const countries = [
  { code: "US", name: "United States" },
  { code: "MN", name: "Монгол" },
];

afterEach(cleanup);

function setup(action = vi.fn(async (): Promise<AddressActionState> => ({ status: "success" }))) {
  const onDone = vi.fn();
  render(<AddressForm action={action} countries={countries} onDone={onDone} onCancel={() => {}} />);
  return { action, onDone };
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("AddressForm", () => {
  it("orders the fields for Mongolia and preselects Mongolia", () => {
    setup();
    const names = Array.from(document.querySelectorAll("input[name], select[name]")).map(
      (element) => element.getAttribute("name"),
    );
    expect(names).toEqual([
      "firstName",
      "lastName",
      "country",
      "countryArea",
      "city",
      "cityArea",
      "streetAddress1",
      "streetAddress2",
      "postalCode",
      "phone",
    ]);
    expect((screen.getByLabelText("address.fields.country") as HTMLSelectElement).value).toBe("MN");
  });

  it("shows field errors before submitting and never calls the action", async () => {
    const { action } = setup();
    fireEvent.click(screen.getByRole("button", { name: "address.book.save" }));
    expect(await screen.findAllByText("errors.required")).toHaveLength(4);
    expect(screen.getByLabelText("address.fields.firstName").getAttribute("aria-invalid")).toBe(
      "true",
    );
    expect(action).not.toHaveBeenCalled();
  });

  it("posts a complete address to the action and calls onDone on success", async () => {
    const { action, onDone } = setup();
    type("address.fields.firstName", "Бат");
    type("address.fields.lastName", "Болд");
    type("address.fields.countryArea", "Улаанбаатар");
    type("address.fields.city", "Сүхбаатар дүүрэг");
    type("address.fields.streetAddress1", "Энхтайваны өргөн чөлөө 5");
    fireEvent.click(screen.getByRole("button", { name: "address.book.save" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const calls = action.mock.calls as unknown as [AddressActionState, FormData][];
    const posted = calls[0]?.[1];
    expect(posted?.get("city")).toBe("Сүхбаатар дүүрэг");
    expect(posted?.get("country")).toBe("MN");
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("shows the API's field errors that come back", async () => {
    const { action } = setup(
      vi.fn(
        async (): Promise<AddressActionState> => ({
          status: "error",
          fieldErrors: { phone: "invalid" },
          values: { firstName: "Бат", lastName: "Болд", phone: "x" },
        }),
      ),
    );
    type("address.fields.firstName", "Бат");
    type("address.fields.lastName", "Болд");
    type("address.fields.city", "Сүхбаатар дүүрэг");
    type("address.fields.streetAddress1", "Энхтайваны өргөн чөлөө 5");
    fireEvent.click(screen.getByRole("button", { name: "address.book.save" }));
    await waitFor(() => expect(action).toHaveBeenCalled());
    expect(await screen.findByText("errors.invalid")).toBeTruthy();
    expect((screen.getByLabelText("address.fields.phone") as HTMLInputElement).value).toBe("x");
  });
});

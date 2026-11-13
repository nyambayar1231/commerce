// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { FormattedMessage } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider, toIntlMessages, useLocale } from "./Locale";

// The Mongolian file as the provider imports it (PLAN M11.1); one translated message.
vi.mock("../../../locale/mn.json", () => ({
  default: { "test-id": { context: "a test message", string: "Сайн байна уу" } },
}));

const Probe = () => {
  const { locale, setLocale } = useLocale();
  return (
    <>
      <p>
        <FormattedMessage id="test-id" defaultMessage="Hello" />
      </p>
      <p>
        <FormattedMessage id="untranslated-id" defaultMessage="Only in English" />
      </p>
      <p data-testid="locale">{locale}</p>
      <button type="button" onClick={() => setLocale("en")}>
        English
      </button>
    </>
  );
};

const renderProbe = () =>
  render(
    <LocaleProvider>
      <Probe />
    </LocaleProvider>,
  );

describe("LocaleProvider", () => {
  beforeEach(() => {
    // The test setup starts every test in English; these start from a first visit.
    localStorage.removeItem("locale");
  });
  afterEach(() => {
    cleanup();
    document.documentElement.lang = "";
  });

  it("shows Mongolian on a first visit, English for untranslated messages", async () => {
    renderProbe();

    expect(await screen.findByText("Сайн байна уу")).toBeTruthy();
    expect(screen.getByText("Only in English")).toBeTruthy();
    expect(screen.getByTestId("locale").textContent).toBe("mn");
    expect(document.documentElement.lang).toBe("mn");
  });

  it("renders nothing until the translations are loaded, so English never flashes", () => {
    const { container } = renderProbe();

    expect(container.textContent).toBe("");
  });

  it("remembers a switch to English", async () => {
    renderProbe();
    await screen.findByText("Сайн байна уу");

    act(() => screen.getByText("English").click());

    expect(await screen.findByText("Hello")).toBeTruthy();
    expect(localStorage.getItem("locale")).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    cleanup();

    renderProbe();
    expect(screen.getByText("Hello")).toBeTruthy();
  });

  it("falls back to Mongolian for an unknown stored language", async () => {
    localStorage.setItem("locale", "xx");

    renderProbe();

    expect(await screen.findByText("Сайн байна уу")).toBeTruthy();
  });
});

describe("toIntlMessages", () => {
  it("keeps the translation of each entry", () => {
    expect(toIntlMessages({ a: { context: "x", string: "А" }, b: { string: "Б" } })).toEqual({
      a: "А",
      b: "Б",
    });
  });
});

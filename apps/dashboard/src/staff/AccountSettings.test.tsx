// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "../components/Locale/Locale";
import { ThemeProvider } from "../theme/provider";
import { StaffSection } from ".";

// Account settings (PLAN M11.2): the signed-in user's own staff page, nobody else's.
const user = {
  __typename: "User" as const,
  id: "VXNlcjox",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  isStaff: true,
  userPermissions: [],
};
vi.mock("../auth/AuthProvider", () => ({ useUser: () => ({ user }) }));

const renderAt = (path: string) =>
  render(
    <ThemeProvider>
      <LocaleProvider>
        <MemoryRouter initialEntries={[path]}>
          <StaffSection />
        </MemoryRouter>
      </LocaleProvider>
    </ThemeProvider>,
  );

describe("Account settings", () => {
  afterEach(cleanup);

  it("shows the signed-in user's profile, read-only, and the dashboard language", () => {
    renderAt(`/${user.id}`);

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Me")).toBeTruthy();
    expect(screen.getByText("Active")).toBeTruthy();
    expect(screen.getByText("My profile")).toBeTruthy();
    const email = screen.getByDisplayValue("ada@example.com") as HTMLInputElement;
    expect(email.disabled).toBe(true);
    expect((screen.getByDisplayValue("Ada") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText("Dashboard language")).toBeTruthy();
    // The test setup starts in English.
    expect(screen.getByDisplayValue("English")).toBeTruthy();
  });

  it("is not found for another staff member", () => {
    renderAt("/VXNlcjoy");

    expect(screen.queryByText("My profile")).toBeNull();
    expect(screen.queryByText("Dashboard language")).toBeNull();
  });
});

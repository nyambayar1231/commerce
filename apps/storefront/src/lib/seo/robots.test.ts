import { describe, expect, it } from "vitest";
import { buildRobots } from "./robots";

describe("buildRobots", () => {
  it("allows the site, disallows the private routes and names the absolute sitemap", () => {
    const robots = buildRobots("https://shop.example");
    expect(robots.sitemap).toBe("https://shop.example/sitemap.xml");
    expect(robots.host).toBeUndefined();
    expect(robots.rules).toEqual({
      userAgent: "*",
      allow: "/",
      disallow: [
        "/cart",
        "/checkout",
        "/account",
        "/order/",
        "/search",
        "/api/",
        "/login",
        "/signup",
        "/reset-password",
        "/set-password",
        "/confirm-account",
      ],
    });
  });
});

import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { middleware, buildForwardedRequestHeaders } from "../middleware";
import { PATHNAME_HEADER } from "../lib/pathname-header";

const ORIGINAL_ENV = { ...process.env };

function requestFrom(options: { ip?: string; auth?: string }) {
  const headers = new Headers();
  if (options.ip) {
    headers.set("x-forwarded-for", options.ip);
  }
  if (options.auth) {
    headers.set("authorization", options.auth);
  }
  return new NextRequest("https://livapon.example.com/", { headers });
}

function basicAuthHeader(user: string, password: string) {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

describe("middleware — pre-launch Basic Auth rate limiting", () => {
  beforeEach(() => {
    process.env.SITE_BASIC_AUTH_USER = "tanaka";
    process.env.SITE_BASIC_AUTH_PASSWORD = "secret";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("blocks with 429 after 5 wrong-password attempts from the same IP, without touching a 6th unrelated IP", async () => {
    const ip = "203.0.113.9";

    for (let i = 0; i < 5; i++) {
      const res = await middleware(requestFrom({ ip, auth: basicAuthHeader("tanaka", "wrong") }));
      expect(res.status).toBe(401);
    }

    const blocked = await middleware(requestFrom({ ip, auth: basicAuthHeader("tanaka", "wrong") }));
    expect(blocked.status).toBe(429);

    // A different IP is unaffected by the first IP's lockout.
    const other = await middleware(requestFrom({ ip: "198.51.100.20", auth: basicAuthHeader("tanaka", "wrong") }));
    expect(other.status).toBe(401);
  });

  it("does not block a correct login even after some prior wrong attempts", async () => {
    const ip = "203.0.113.55";

    await middleware(requestFrom({ ip, auth: basicAuthHeader("tanaka", "wrong") }));
    await middleware(requestFrom({ ip, auth: basicAuthHeader("tanaka", "wrong") }));

    const res = await middleware(requestFrom({ ip, auth: basicAuthHeader("tanaka", "secret") }));
    expect(res.status).toBe(200);
  });
});

describe("middleware — pathname forwarding", () => {
  it("sets the pathname header for the root layout to read", () => {
    const request = new NextRequest("https://livapon.example.com/raffle/ca26");
    const headers = buildForwardedRequestHeaders(request);
    expect(headers.get(PATHNAME_HEADER)).toBe("/raffle/ca26");
  });

  it("preserves the request's existing headers alongside the new one", () => {
    const request = new NextRequest("https://livapon.example.com/me", { headers: { "x-forwarded-for": "203.0.113.9" } });
    const headers = buildForwardedRequestHeaders(request);
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.9");
    expect(headers.get(PATHNAME_HEADER)).toBe("/me");
  });
});

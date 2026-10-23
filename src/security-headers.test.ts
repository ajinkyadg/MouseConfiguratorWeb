/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";

const files = import.meta.glob(["../*.html", "../public/_headers"], { query: "?raw", import: "default", eager: true }) as Record<string, string>;
const headers = files["../public/_headers"];
const pages = Object.keys(files).filter((f) => f.endsWith(".html")).map((f) => f.slice(3));
const sha256 = async (text: string) => {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return btoa(String.fromCharCode(...digest));
};
const header = (name: string) => headers.match(new RegExp(`^\\s+${name}: (.+)$`, "m"))?.[1] ?? "";
const csp = header("Content-Security-Policy");
const directive = (name: string) => csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " ")) ?? "";

describe("security headers (public/_headers)", () => {
  it("finds the headers file and all pages", () => {
    expect(headers).toBeTruthy();
    expect(pages.length).toBeGreaterThanOrEqual(9);
  });

  it("applies to every path", () => {
    expect(headers).toMatch(/^\/\*$/m);
  });

  it("sends the baseline headers", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Strict-Transport-Security")).toMatch(/max-age=\d{8,}/);
    expect(header("Permissions-Policy")).toContain("hid=(self)");
  });

  it("locks down framing, plugins, base URLs and forms", () => {
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("base-uri")).toBe("base-uri 'self'");
    expect(directive("form-action")).toBe("form-action 'none'");
    expect(directive("default-src")).toBe("default-src 'self'");
  });

  it("never allows inline script by blanket keyword", () => {
    expect(directive("script-src")).not.toMatch(/'unsafe-inline'|'unsafe-eval'|\*/);
  });
});

describe.each(pages)("%s against the content security policy", (page) => {
  const html = files[`../${page}`];

  it("every inline script is allowed by its hash", async () => {
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)].filter(([, attrs]) => !attrs.includes("ld+json"));
    for (const [, , body] of inline) {
      const hash = `'sha256-${await sha256(body)}'`;
      expect(directive("script-src"), "update the hash in public/_headers").toContain(hash);
    }
  });

  it("has no inline event handlers or javascript: links", () => {
    expect(html).not.toMatch(/\son[a-z]+\s*=\s*["']/i);
    expect(html).not.toMatch(/href\s*=\s*["']\s*javascript:/i);
  });

  it("loads scripts only from this site", () => {
    const external = [...html.matchAll(/<script[^>]*\bsrc="(https?:[^"]+)"/g)].map((m) => m[1]);
    expect(external).toEqual([]);
  });

  it("opens new tabs without giving them access to this page", () => {
    for (const [tag] of html.matchAll(/<a\s[^>]*target="_blank"[^>]*>/g)) expect(tag).toMatch(/rel="[^"]*noopener[^"]*"/);
  });
});

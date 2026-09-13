import { describe, expect, it } from "vitest";
import { resolveAuthDomain } from "./authDomain";

const PROJECT = "fantasy-parlay-tracker";
const CONFIGURED = "fantasy-parlay-tracker.firebaseapp.com";

describe("resolveAuthDomain", () => {
  // The bug this exists for: the app is served from .web.app while the
  // configured authDomain is .firebaseapp.com, so the sign-in redirect crosses
  // origins and Safari partitions its state away.
  it("uses the serving domain on the project's own Hosting site", () => {
    expect(resolveAuthDomain(`${PROJECT}.web.app`, PROJECT, CONFIGURED)).toBe(
      `${PROJECT}.web.app`,
    );
  });

  it("also matches the firebaseapp.com Hosting domain", () => {
    expect(resolveAuthDomain(`${PROJECT}.firebaseapp.com`, PROJECT, CONFIGURED)).toBe(
      `${PROJECT}.firebaseapp.com`,
    );
  });

  it("falls back to the configured domain on localhost", () => {
    expect(resolveAuthDomain("localhost", PROJECT, CONFIGURED)).toBe(CONFIGURED);
    expect(resolveAuthDomain("127.0.0.1", PROJECT, CONFIGURED)).toBe(CONFIGURED);
  });

  // A preview channel serves the handler but its redirect URI is not
  // registered with the OAuth client, so sending the handshake there would
  // swap one broken sign-in for another.
  it("ignores preview channels", () => {
    expect(
      resolveAuthDomain(`${PROJECT}--pr12-a1b2c3.web.app`, PROJECT, CONFIGURED),
    ).toBe(CONFIGURED);
  });

  it("ignores another project's Hosting domain", () => {
    expect(resolveAuthDomain("someone-else.web.app", PROJECT, CONFIGURED)).toBe(CONFIGURED);
  });

  // Suffix matching would accept this; the domain is not ours.
  it("is not fooled by a lookalike suffix", () => {
    expect(resolveAuthDomain(`evil-${PROJECT}.web.app`, PROJECT, CONFIGURED)).toBe(CONFIGURED);
    expect(resolveAuthDomain(`${PROJECT}.web.app.evil.com`, PROJECT, CONFIGURED)).toBe(
      CONFIGURED,
    );
  });

  it("leaves a custom domain to the configured value", () => {
    expect(resolveAuthDomain("parlay.example.com", PROJECT, CONFIGURED)).toBe(CONFIGURED);
  });
});

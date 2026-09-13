import { describe, expect, it } from "vitest";
import { shortNames } from "./reactionNames";

describe("shortNames", () => {
  it("keeps first names when they are distinct", () => {
    expect(shortNames(["Ann Alvarez", "Bo Chen"])).toEqual(["Ann", "Bo"]);
  });

  it("leaves a single-word name alone", () => {
    expect(shortNames(["Cy"])).toEqual(["Cy"]);
  });

  // The case that would otherwise read as "Mike, Mike".
  it("adds a last initial when two people share a first name", () => {
    expect(shortNames(["Mike Rossi", "Mike Tran", "Ann Alvarez"])).toEqual([
      "Mike R.",
      "Mike T.",
      "Ann",
    ]);
  });

  it("falls back to the full name when there is no surname to add", () => {
    expect(shortNames(["Mike", "Mike Tran"])).toEqual(["Mike", "Mike T."]);
  });

  it("survives a blank display name", () => {
    expect(shortNames([""])).toEqual(["Someone"]);
    expect(shortNames(["   "])).toEqual(["Someone"]);
  });

  it("ignores extra whitespace", () => {
    expect(shortNames(["  Ann   Alvarez  "])).toEqual(["Ann"]);
  });
});

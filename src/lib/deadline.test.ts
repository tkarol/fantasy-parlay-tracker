import { describe, expect, it } from "vitest";
import {
  DEFAULT_DEADLINE_RULE,
  describeDeadlineRule,
  nextDeadline,
  zonedTimeToInstant,
} from "./dates";

/**
 * The league's season runs September to January, which crosses the end of
 * daylight saving. Noon Eastern is a different UTC instant on either side of
 * it, so these assert real UTC values rather than trusting an offset.
 */
describe("zonedTimeToInstant", () => {
  it("resolves noon Eastern during daylight saving", () => {
    // 13 Sep 2026 is EDT (UTC-4), so noon is 16:00 UTC.
    expect(zonedTimeToInstant(2026, 8, 13, 12, 0, "America/New_York").toISOString()).toBe(
      "2026-09-13T16:00:00.000Z",
    );
  });

  it("resolves noon Eastern after the clocks go back", () => {
    // 6 Dec 2026 is EST (UTC-5), so noon is 17:00 UTC — an hour later.
    expect(zonedTimeToInstant(2026, 11, 6, 12, 0, "America/New_York").toISOString()).toBe(
      "2026-12-06T17:00:00.000Z",
    );
  });

  it("is correct on the changeover day itself", () => {
    // Clocks go back at 2am on 1 Nov 2026; noon that day is already EST.
    expect(zonedTimeToInstant(2026, 10, 1, 12, 0, "America/New_York").toISOString()).toBe(
      "2026-11-01T17:00:00.000Z",
    );
  });

  it("rolls a day number past the end of the month into the next one", () => {
    expect(zonedTimeToInstant(2026, 8, 33, 12, 0, "America/New_York").toISOString()).toBe(
      "2026-10-03T16:00:00.000Z",
    );
  });
});

describe("nextDeadline", () => {
  it("finds the coming Sunday noon from midweek", () => {
    const from = new Date("2026-09-09T15:00:00Z"); // Wednesday
    expect(nextDeadline(DEFAULT_DEADLINE_RULE, from).toISOString()).toBe(
      "2026-09-13T16:00:00.000Z",
    );
  });

  it("still points at today when Sunday morning has not reached noon", () => {
    const from = new Date("2026-09-13T14:00:00Z"); // 10am Eastern, same Sunday
    expect(nextDeadline(DEFAULT_DEADLINE_RULE, from).toISOString()).toBe(
      "2026-09-13T16:00:00.000Z",
    );
  });

  it("moves to next week once the deadline has passed", () => {
    const from = new Date("2026-09-13T16:00:00Z"); // exactly the deadline
    expect(nextDeadline(DEFAULT_DEADLINE_RULE, from).toISOString()).toBe(
      "2026-09-20T16:00:00.000Z",
    );
  });

  it("carries the right offset across the DST change week to week", () => {
    const before = nextDeadline(DEFAULT_DEADLINE_RULE, new Date("2026-10-26T12:00:00Z"));
    const after = nextDeadline(DEFAULT_DEADLINE_RULE, new Date("2026-11-02T12:00:00Z"));
    expect(before.toISOString()).toBe("2026-11-01T17:00:00.000Z");
    expect(after.toISOString()).toBe("2026-11-08T17:00:00.000Z");
  });

  it("does not depend on the machine's own time zone", () => {
    // The rule names its zone, so the result is an absolute instant either way.
    const from = new Date("2026-09-09T15:00:00Z");
    const result = nextDeadline(DEFAULT_DEADLINE_RULE, from);
    expect(result.getTime()).toBe(Date.parse("2026-09-13T16:00:00Z"));
  });

  it("honours a different weekday and time", () => {
    const thursdayEvening = { weekday: 4, hour: 20, minute: 15, timeZone: "America/New_York" };
    expect(nextDeadline(thursdayEvening, new Date("2026-09-14T12:00:00Z")).toISOString()).toBe(
      // 8:15pm Eastern on Thursday the 17th is already the 18th in UTC.
      "2026-09-18T00:15:00.000Z",
    );
  });
});

describe("describeDeadlineRule", () => {
  it("reads as a sentence with the right zone abbreviation", () => {
    const inSeason = describeDeadlineRule(DEFAULT_DEADLINE_RULE, new Date("2026-09-13T16:00:00Z"));
    expect(inSeason).toContain("Sundays at");
    expect(inSeason).toContain("EDT");

    const inWinter = describeDeadlineRule(DEFAULT_DEADLINE_RULE, new Date("2026-12-06T17:00:00Z"));
    expect(inWinter).toContain("EST");
  });
});

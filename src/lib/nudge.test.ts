import { describe, expect, it } from "vitest";
import { buildDeadlineCalendar, buildNudgeMessage, formatNameList, membersMissingLegs } from "./nudge";
import { leg, makeWeek } from "./testing";
import type { Member } from "../types/models";

function member(uid: string, displayName: string): Member {
  return { uid, role: "member", displayName, email: `${uid}@x.test`, photoURL: null, joinedAt: null };
}

const ROSTER = [member("a", "Ann"), member("b", "Bo"), member("c", "Cy")];
const NOW = new Date("2026-09-10T12:00:00Z");
const URL = "https://parlay.example";

describe("membersMissingLegs", () => {
  it("names who has not submitted", () => {
    const missing = membersMissingLegs(ROSTER, [leg("a", -110)]);
    expect(missing.map((m) => m.displayName)).toEqual(["Bo", "Cy"]);
  });

  it("is empty once everyone is in", () => {
    expect(membersMissingLegs(ROSTER, [leg("a", -110), leg("b", 100), leg("c", 120)])).toEqual([]);
  });

  it("ignores legs with no owner, which belong to nobody on the roster", () => {
    const orphan = { ...leg("", 100), uid: "", memberName: "Ann" };
    expect(membersMissingLegs(ROSTER, [orphan]).map((m) => m.displayName)).toEqual([
      "Ann",
      "Bo",
      "Cy",
    ]);
  });
});

describe("formatNameList", () => {
  it("reads as a sentence", () => {
    expect(formatNameList(["Ann"])).toBe("Ann");
    expect(formatNameList(["Ann", "Bo"])).toBe("Ann and Bo");
    expect(formatNameList(["Ann", "Bo", "Cy"])).toBe("Ann, Bo and Cy");
    expect(formatNameList([])).toBe("");
  });
});

describe("buildNudgeMessage", () => {
  const week = makeWeek({ week: 3, deadline: new Date("2026-09-10T18:00:00Z") });

  it("names the stragglers and how long they have", () => {
    const message = buildNudgeMessage({
      week,
      missing: [ROSTER[1]!, ROSTER[2]!],
      now: NOW,
      url: URL,
      leagueName: "Sunday Degenerates",
    });
    expect(message).toContain("Sunday Degenerates — week 3");
    expect(message).toContain("still need picks from Bo and Cy");
    expect(message).toContain("Locks in 6h 0m");
    expect(message).toContain(URL);
  });

  it("uses the singular for one straggler", () => {
    const message = buildNudgeMessage({ week, missing: [ROSTER[1]!], now: NOW, url: URL });
    expect(message).toContain("still need a pick from Bo");
  });

  it("says so when the deadline has passed", () => {
    const message = buildNudgeMessage({
      week,
      missing: [ROSTER[1]!],
      now: new Date("2026-09-11T00:00:00Z"),
      url: URL,
    });
    expect(message).toContain("Picks are closed.");
  });

  it("celebrates a full ticket instead of nagging", () => {
    const message = buildNudgeMessage({ week, missing: [], now: NOW, url: URL });
    expect(message).toContain("everyone's in");
  });

  it("copes with a week that has no deadline", () => {
    const message = buildNudgeMessage({
      week: makeWeek({ week: 3, deadline: null }),
      missing: [ROSTER[1]!],
      now: NOW,
      url: URL,
    });
    expect(message).toContain("Bo");
    expect(message).not.toContain("Locks in");
  });
});

describe("buildDeadlineCalendar", () => {
  const week = makeWeek({ week: 3, deadline: new Date("2026-09-10T18:00:00Z") });

  it("produces a weekly repeating event with an alarm", () => {
    const ics = buildDeadlineCalendar(week, URL, "Sunday Degenerates");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("DTSTART:20260910T180000Z");
    expect(ics).toContain("RRULE:FREQ=WEEKLY");
    expect(ics).toContain("TRIGGER:-PT2H");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("uses CRLF line endings, which the iCalendar format requires", () => {
    const ics = buildDeadlineCalendar(week, URL, "Sunday Degenerates");
    expect(ics.split("\r\n").length).toBeGreaterThan(10);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("escapes commas in the league name rather than splitting the field", () => {
    const ics = buildDeadlineCalendar(week, URL, "Ann, Bo and Cy");
    expect(ics).toContain("Ann\\, Bo and Cy");
  });

  it("keeps every line within the 75 octet limit", () => {
    const ics = buildDeadlineCalendar(week, `${URL}/${"x".repeat(120)}`, "Sunday Degenerates");
    for (const line of ics.split("\r\n")) {
      expect(line.length).toBeLessThanOrEqual(75);
    }
  });

  it("refuses a week with no deadline", () => {
    expect(() => buildDeadlineCalendar(makeWeek({ deadline: null }), URL, "X")).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import type { QueryDocumentSnapshot } from "firebase/firestore";
import { legConverter, leagueConverter, readTicketImage, weekConverter } from "./converters";

/** Minimal stand-in: the converters only touch `id` and `data()`. */
function snap(id: string, data: Record<string, unknown>): QueryDocumentSnapshot {
  return { id, data: () => data } as unknown as QueryDocumentSnapshot;
}

describe("legacy document tolerance", () => {
  it("reads a v1 league that predates defaultStake", () => {
    const league = leagueConverter.fromFirestore(
      snap("my-league-ab12", {
        name: "The Degenerates",
        ownerUid: "u1",
        inviteCode: "ABC123",
        memberUids: ["u1", "u2"],
        createdAt: { seconds: 1700000000 },
      }),
    );
    expect(league.defaultStake).toBe(5);
    expect(league.memberUids).toEqual(["u1", "u2"]);
    expect(league.createdAt).toBeInstanceOf(Date);
  });

  it("reads a v1 week that predates notes and ticket images", () => {
    const week = weekConverter.fromFirestore(
      snap("2025-3", { season: 2025, week: 3, stake: 5, closed: true }),
    );
    expect(week.ticketImage).toBeNull();
    expect(week.payoutOverride).toBeNull();
    expect(week.note).toBe("");
    expect(week.closed).toBe(true);
  });

  it("recovers season and week from the document id when the fields are absent", () => {
    const week = weekConverter.fromFirestore(snap("2024-12", { stake: 10 }));
    expect(week.season).toBe(2024);
    expect(week.week).toBe(12);
  });

  it("converts a legacy empty-string odds value to null", () => {
    const leg = legConverter.fromFirestore(snap("u1", { odds: "", leg: "Bills -3", createdBy: "u1" }));
    expect(leg.odds).toBeNull();
  });

  it("attributes a legacy member leg by its document id", () => {
    // v1 wrote member legs at legs/{uid} with createdBy set to the same uid.
    const leg = legConverter.fromFirestore(
      snap("user-123", { memberName: "Ann", leg: "Bills ML", odds: -140, createdBy: "user-123" }),
    );
    expect(leg.uid).toBe("user-123");
  });

  it("does not attribute a legacy admin-entered leg to the admin who typed it", () => {
    // v1 let admins add legs at an auto id with createdBy = the admin's uid.
    // Crediting that admin would corrupt the leaderboard, so it stays unowned
    // and gets grouped by name instead.
    const leg = legConverter.fromFirestore(
      snap("aUt0GeNeRaTeDiD", { memberName: "Dave", leg: "Chiefs -7", odds: 120, createdBy: "admin-uid" }),
    );
    expect(leg.uid).toBe("");
    expect(leg.memberName).toBe("Dave");
  });

  it("falls back to Pending for an unrecognised result", () => {
    expect(legConverter.fromFirestore(snap("u1", { result: "weird" })).result).toBe("Pending");
    expect(legConverter.fromFirestore(snap("u1", {})).result).toBe("Pending");
  });

  it("survives a completely empty document", () => {
    const leg = legConverter.fromFirestore(snap("u1", {}));
    expect(leg.leg).toBe("");
    expect(leg.odds).toBeNull();
    expect(leg.createdAt).toBeNull();
  });
});

describe("ticket screenshot compatibility", () => {
  it("reads a current image stored as a data URL", () => {
    const image = readTicketImage({
      src: "data:image/jpeg;base64,abc",
      width: 800,
      height: 1200,
      bytes: 27,
      uploadedByUid: "u1",
      uploadedByName: "Ann",
    });
    expect(image?.src).toBe("data:image/jpeg;base64,abc");
    expect(image?.width).toBe(800);
  });

  it("still reads a screenshot left behind by the Cloud Storage version", () => {
    // v2 wrote { path, url } onto the week document instead of its own doc.
    const image = readTicketImage({
      path: "leagues/x/weeks/2025-1/tickets/u1/ticket.jpg",
      url: "https://firebasestorage.googleapis.com/v0/b/x/o/ticket.jpg",
      width: 900,
      height: 1400,
      uploadedByUid: "u1",
      uploadedByName: "Ann",
    });
    expect(image?.src).toBe("https://firebasestorage.googleapis.com/v0/b/x/o/ticket.jpg");
    expect(image?.height).toBe(1400);
  });

  it("is null when there is no image at all", () => {
    expect(readTicketImage(null)).toBeNull();
    expect(readTicketImage({})).toBeNull();
    expect(readTicketImage({ width: 10 })).toBeNull();
  });
});

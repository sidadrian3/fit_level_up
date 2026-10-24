import { describe, it, expect } from "vitest";
import { getPeriodForCategory, periodRange } from "../quest.rules";

describe("getPeriodForCategory", () => {
  const instant = new Date("2026-10-25T17:00:00Z");

  it("uses the user's local day for daily quests", () => {
    expect(getPeriodForCategory("daily", instant, "Asia/Manila")).toEqual({
      periodStart: "2026-10-26",
      periodEnd: "2026-10-26",
    });
  });

  it("spans Monday to Sunday of the user's local week for weekly quests", () => {
    expect(getPeriodForCategory("weekly", instant, "Asia/Manila")).toEqual({
      periodStart: "2026-10-26",
      periodEnd: "2026-11-01",
    });
    expect(getPeriodForCategory("weekly", instant, "UTC")).toEqual({
      periodStart: "2026-10-19",
      periodEnd: "2026-10-25",
    });
    expect(getPeriodForCategory("weekly", new Date("2026-10-26T03:00:00Z"), "America/New_York")).toEqual({
      periodStart: "2026-10-19",
      periodEnd: "2026-10-25",
    });
  });

  it("uses a fixed all-time period for special quests", () => {
    expect(getPeriodForCategory("special", instant, "UTC")).toEqual({
      periodStart: null,
      periodEnd: null,
    });
  });
});

describe("periodRange", () => {
  it("covers a single local day in the user's time zone", () => {
    expect(periodRange({ periodStart: "2026-03-10", periodEnd: "2026-03-10" }, "Asia/Manila")).toEqual({
      from: new Date("2026-03-09T16:00:00Z"),
      toExclusive: new Date("2026-03-10T16:00:00Z"),
    });
  });

  it("covers a whole week up to the start of the day after periodEnd", () => {
    expect(periodRange({ periodStart: "2026-03-09", periodEnd: "2026-03-15" }, "UTC")).toEqual({
      from: new Date("2026-03-09T00:00:00Z"),
      toExclusive: new Date("2026-03-16T00:00:00Z"),
    });
  });

  it("is null for a period with no bounds", () => {
    expect(periodRange({ periodStart: null, periodEnd: null }, "UTC")).toBeNull();
  });
});

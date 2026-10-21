import { describe, expect, it } from "vitest";
import { addDays, isValidTimeZone, startOfLocalDay, startOfWeek, toLocalDay } from "../dates";
import { timeZoneSchema } from "@/lib/validations/schemas";

describe("toLocalDay", () => {
  it("resolves the calendar day in the given zone", () => {
    expect(toLocalDay(new Date("2026-10-20T23:00:00Z"), "Asia/Manila")).toBe("2026-10-21");
    expect(toLocalDay(new Date("2026-10-21T04:00:00Z"), "America/New_York")).toBe("2026-10-21");
    expect(toLocalDay(new Date("2026-10-21T04:00:00Z"), "UTC")).toBe("2026-10-21");
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-03-31", 1)).toBe("2026-04-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("startOfWeek", () => {
  it("returns the Monday", () => {
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
    expect(startOfWeek("2026-10-19")).toBe("2026-10-19");
  });
});

describe("startOfLocalDay", () => {
  it.each([
    ["2026-10-21", "Asia/Manila", "2026-10-20T16:00:00.000Z"],
    ["2026-03-08", "America/New_York", "2026-03-08T05:00:00.000Z"],
    ["2026-03-09", "America/New_York", "2026-03-09T04:00:00.000Z"],
    ["2026-11-01", "America/New_York", "2026-11-01T04:00:00.000Z"],
    ["2026-09-06", "America/Santiago", "2026-09-06T04:00:00.000Z"],
  ])("%s in %s", (day, zone, expected) => {
    expect(startOfLocalDay(day, zone).toISOString()).toBe(expected);
  });
});

describe("isValidTimeZone", () => {
  it("accepts IANA names and rejects offsets and junk", () => {
    for (const ok of ["UTC", "Asia/Calcutta", "Asia/Manila"]) expect(isValidTimeZone(ok)).toBe(true);
    for (const bad of ["+08:00", "-05:00", "", "Mars/Base"]) expect(isValidTimeZone(bad)).toBe(false);
  });
});

describe("timeZoneSchema", () => {
  it("validates time zones", () => {
    expect(timeZoneSchema.safeParse("Asia/Manila").success).toBe(true);
    expect(timeZoneSchema.safeParse("+08:00").success).toBe(false);
    expect(timeZoneSchema.safeParse("x".repeat(65)).success).toBe(false);
  });
});

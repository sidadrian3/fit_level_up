import { describe, expect, it } from "vitest";
import { formatActivityDate } from "../formatters";

describe("formatActivityDate", () => {
  const lateEveningUtc = "2026-03-10T23:30:00.000Z";

  it("renders a 23:30 UTC workout as the next local day for a Manila user", () => {
    expect(formatActivityDate(lateEveningUtc, "Asia/Manila")).toBe("Mar 11, 2026");
  });

  it("keeps the UTC day for a UTC user", () => {
    expect(formatActivityDate(lateEveningUtc, "UTC")).toBe("Mar 10, 2026");
  });
});

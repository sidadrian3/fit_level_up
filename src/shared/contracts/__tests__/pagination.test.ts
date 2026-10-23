import { describe, it, expect } from "vitest";
import { paginationQuery } from "../pagination";

describe("paginationQuery", () => {
  it.each([
    [undefined, 5],
    ["", 5],
    ["abc", 5],
    ["0", 5],
    ["-3", 5],
    ["7", 7],
    ["10abc", 10],
    ["500", 50],
    ["50", 50],
    ["51", 50],
  ])("clamps limit %j to %i", (raw, expected) => {
    expect(paginationQuery.parse({ limit: raw }).limit).toBe(expected);
  });

  it.each([
    [undefined, 1],
    ["abc", 1],
    ["0", 1],
    ["-1", 1],
    ["2", 2],
  ])("clamps page %j to %i", (raw, expected) => {
    expect(paginationQuery.parse({ page: raw }).page).toBe(expected);
  });
});

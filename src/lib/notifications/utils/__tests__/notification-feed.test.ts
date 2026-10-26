import { describe, expect, it } from "vitest";
import type { Notification } from "@/shared/contracts/notification";
import {
  extendFastWindow,
  mergeFeed,
  nextPollInterval,
  selectToastBatch,
} from "../notification-feed";

function n(
  id: string,
  createdAtMs: number,
  readAt: string | null = null,
): Notification {
  return {
    id,
    actor: null,
    createdAt: new Date(createdAtMs).toISOString(),
    readAt,
    type: "friend.leveled-up",
    data: { newLevel: 2 },
  };
}

function many(count: number, offset = 0): Notification[] {
  return Array.from({ length: count }, (_, i) =>
    n(`id-${offset + i}`, offset + i),
  );
}

describe("mergeFeed", () => {
  it("drops a duplicate id returned again by an inclusive since", () => {
    expect(
      mergeFeed([n("a", 3)], [n("a", 3), n("b", 4)], 50).map((x) => x.id),
    ).toEqual(["b", "a"]);
  });

  it("keeps the newest 50", () => {
    const merged = mergeFeed(many(40), many(20, 100), 50);
    expect(merged).toHaveLength(50);
    expect(merged[0].id).toBe("id-119");
  });

  it("takes the incoming copy so readAt updates", () => {
    const readAt = new Date(10).toISOString();
    const merged = mergeFeed([n("a", 3)], [n("a", 3, readAt)], 50);
    expect(merged).toHaveLength(1);
    expect(merged[0].readAt).toBe(readAt);
  });

  it("returns a single copy when an equal since returns only the newest row again", () => {
    const merged = mergeFeed([n("a", 3), n("b", 2)], [n("a", 3)], 50);
    expect(merged.map((x) => x.id)).toEqual(["a", "b"]);
  });
});

describe("selectToastBatch", () => {
  it("ignores entries from before the tab became visible", () => {
    expect(
      selectToastBatch([n("a", 5), n("b", 15)], {
        loadedAt: 0,
        visibleSince: 10,
      }).map((x) => x.id),
    ).toEqual(["b"]);
  });

  it("ignores the first load", () => {
    expect(
      selectToastBatch([n("a", 5)], { loadedAt: 5, visibleSince: 0 }),
    ).toEqual([]);
  });
});

describe("polling window", () => {
  it("nextPollInterval is 2 s inside the window and 30 s after it", () => {
    expect(nextPollInterval(1_000, 5_000)).toBe(2_000);
    expect(nextPollInterval(5_000, 5_000)).toBe(30_000);
  });

  it("extendFastWindow moves the deadline instead of stacking", () => {
    expect(extendFastWindow(3_000)).toBe(13_000);
  });
});

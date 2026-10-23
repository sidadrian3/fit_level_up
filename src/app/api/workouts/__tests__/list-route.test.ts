import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { getCollection } from "@/server/platform/database";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn(),
}));

const userId = "workout-list-route-user";
const seededCount = 120;

function list(query = "") {
  return GET(new Request(`http://localhost:3000/api/workouts${query}`));
}

describe("GET /api/workouts pagination", () => {
  beforeAll(() => {
    vi.mocked(getAuthUserId).mockResolvedValue(userId);
  });

  beforeEach(async () => {
    const workouts = await getCollection("workouts");
    await workouts.insertMany(
      Array.from({ length: seededCount }, (_, index) => ({
        userId,
        title: `Workout ${index}`,
        exercises: [],
        duration: 30,
        xpEarned: 10,
        date: new Date(),
      }))
    );
  });

  afterEach(async () => {
    await (await getCollection("workouts")).deleteMany({ userId });
  });

  it("caps limit at 50 and computes totalPages with 50", async () => {
    const body = await (await list("?limit=500")).json();

    expect(body.data.length).toBeLessThanOrEqual(50);
    expect(body.totalCount).toBe(seededCount);
    expect(body.totalPages).toBe(Math.ceil(seededCount / 50));
  });

  it("defaults to limit 5 on page 1", async () => {
    const body = await (await list()).json();

    expect(body.data).toHaveLength(5);
    expect(body.currentPage).toBe(1);
    expect(body.totalPages).toBe(Math.ceil(seededCount / 5));
  });
});

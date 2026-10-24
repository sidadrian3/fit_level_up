import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET } from "../route";
import { getCollection } from "@/server/platform/database";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn(),
}));

const userId = "records-route-user";

type RecordRow = { label: string; value: string; type: string };

function exercise(name: string, weight: number | null) {
  return { name, targetMuscle: "Chest" as const, sets: 3, reps: 5, weight };
}

describe("GET /api/profile/records", () => {
  beforeEach(() => {
    vi.mocked(getAuthUserId).mockResolvedValue(userId);
  });

  afterEach(async () => {
    await (await getCollection("workouts")).deleteMany({ userId });
    await (await getCollection("runs")).deleteMany({ userId });
  });

  async function getRecords(): Promise<RecordRow[]> {
    const response = await GET(new Request("http://localhost:3000/api/profile/records"));
    expect(response.status).toBe(200);
    return response.json();
  }

  async function insertWorkout(exercises: ReturnType<typeof exercise>[]) {
    await (await getCollection("workouts")).insertOne({
      userId, title: "Session", exercises, duration: 45, xpEarned: 100, date: new Date(),
    });
  }

  async function insertRuns(runs: { distance: number; duration: number }[]) {
    await (await getCollection("runs")).insertMany(
      runs.map((run) => ({ userId, ...run, pace: run.duration / run.distance, difficulty: "moderate" as const, xpEarned: 50, date: new Date() })),
    );
  }

  it("returns an empty list for an empty history", async () => {
    expect(await getRecords()).toEqual([]);
  });

  it("keeps the top three lifts by max weight per case-insensitive name, with the heaviest set's casing", async () => {
    await insertWorkout([
      exercise("bench press", 60),
      exercise("Squat", 100),
      exercise("Deadlift", 120),
      exercise("Overhead Press", 40),
      exercise("Curl", null),
      exercise("Row", 0),
    ]);
    await insertWorkout([exercise("Bench Press", 80), exercise("squat", 90)]);

    expect((await getRecords()).filter((record) => record.type === "strength")).toEqual([
      { label: "Deadlift", value: "120 kg", type: "strength" },
      { label: "Squat", value: "100 kg", type: "strength" },
      { label: "Bench Press", value: "80 kg", type: "strength" },
    ]);
  });

  it("finds the fastest 5K and 10K inside their distance windows and the longest run", async () => {
    await insertRuns([
      { distance: 5, duration: 28 },
      { distance: 5.2, duration: 25 },
      { distance: 4.8, duration: 29 },
      { distance: 5.3, duration: 10 },
      { distance: 4.7, duration: 10 },
      { distance: 10, duration: 60 },
      { distance: 9.8, duration: 55 },
      { distance: 10.3, duration: 20 },
      { distance: 21.1, duration: 130 },
    ]);

    expect(await getRecords()).toEqual([
      { label: "Fastest 5K", value: "25m", type: "cardio" },
      { label: "Fastest 10K", value: "55m", type: "cardio" },
      { label: "Longest Run", value: "21.1 km", type: "endurance" },
    ]);
  });

  it("omits the 5K and 10K records when no run falls in the windows", async () => {
    await insertRuns([{ distance: 3, duration: 20 }]);

    expect(await getRecords()).toEqual([{ label: "Longest Run", value: "3 km", type: "endurance" }]);
  });

  it("ignores another user's history", async () => {
    await (await getCollection("runs")).insertOne({
      userId: "records-other-user", distance: 42, duration: 300, pace: 7, difficulty: "hard", xpEarned: 1, date: new Date(),
    });

    try {
      expect(await getRecords()).toEqual([]);
    } finally {
      await (await getCollection("runs")).deleteMany({ userId: "records-other-user" });
    }
  });
});

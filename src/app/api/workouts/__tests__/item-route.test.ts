import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import { PUT, DELETE } from "../[id]/route";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getCollection, type PlayerProfileDoc } from "@/server/platform/database";
import { seedPlayer, deletePlayer } from "@/testing/players";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn(),
}));

const NOT_FOUND = "Workout not found or invalid ID";
const unknownId = "64b7f0c2a1b2c3d4e5f60718";

const validBody = {
  title: "Push Day",
  exercises: [{ name: "Bench Press", targetMuscle: "Chest", sets: 3, reps: 10, weight: 60 }],
  duration: 45,
};

function put(id: string) {
  return PUT(
    new Request(`http://localhost:3000/api/workouts/${id}`, { method: "PUT", body: JSON.stringify(validBody) }),
    { params: Promise.resolve({ id }) }
  );
}

function del(id: string) {
  return DELETE(new Request(`http://localhost:3000/api/workouts/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

describe("/api/workouts/[id]", () => {
  beforeAll(() => {
    vi.mocked(getAuthUserId).mockResolvedValue("workout-item-route-user");
  });

  it.each([
    ["unknown", unknownId],
    ["malformed", "abc"],
  ])("PUT returns 404 for an %s id", async (_label, id) => {
    const response = await put(id);

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe(NOT_FOUND);
  });

  it.each([
    ["unknown", unknownId],
    ["malformed", "abc"],
  ])("DELETE returns 404 for an %s id", async (_label, id) => {
    const response = await del(id);

    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe(NOT_FOUND);
  });
});

describe("/api/workouts/[id] with stored rows", () => {
  const originalDate = new Date("2026-03-04T10:00:00Z");
  const startingProfile = { totalXp: 750, totalWorkouts: 4, totalDistance: 12.5, streak: 2 };
  let userId: string;
  let otherUserId: string;

  async function insertRow(owner: string): Promise<string> {
    const { insertedId } = await (await getCollection("workouts")).insertOne({ userId: owner, title: "Old Title", exercises: [], duration: 10, xpEarned: 1, date: originalDate });
    return insertedId.toString();
  }

  async function readProfile() {
    return (await getCollection<PlayerProfileDoc>("playerProfiles")).findOne({ _id: userId });
  }

  beforeEach(async () => {
    userId = await seedPlayer({ email: `workouts-item-${crypto.randomUUID()}@example.com`, name: "Owner", profile: startingProfile });
    otherUserId = await seedPlayer({ email: `workouts-other-${crypto.randomUUID()}@example.com`, name: "Other" });
    vi.mocked(getAuthUserId).mockResolvedValue(userId);
  });

  afterEach(async () => {
    await (await getCollection("workouts")).deleteMany({ userId: { $in: [userId, otherUserId] } });
    await deletePlayer(userId);
    await deletePlayer(otherUserId);
  });

  it("PUT recomputes xpEarned and keeps the original date", async () => {
    const id = await insertRow(userId);

    const response = await put(id);
    const updated = await response.json();

    expect(response.status).toBe(200);
    expect(updated).toMatchObject({ title: "Push Day", duration: 45, xpEarned: 105 });
    expect(updated.date).toBe(originalDate.toISOString());
    const stored = await (await getCollection("workouts")).findOne({ _id: new ObjectId(id) });
    expect(stored).toMatchObject({ xpEarned: 105 });
    expect(stored?.date).toEqual(originalDate);
  });

  it("PUT returns 404 for another user's row and leaves it untouched", async () => {
    const id = await insertRow(otherUserId);

    const response = await put(id);

    expect(response.status).toBe(404);
    expect(await (await getCollection("workouts")).findOne({ _id: new ObjectId(id) })).toMatchObject({ xpEarned: 1 });
  });

  it("DELETE returns 404 for another user's row and keeps it", async () => {
    const id = await insertRow(otherUserId);

    const response = await del(id);

    expect(response.status).toBe(404);
    expect(await (await getCollection("workouts")).countDocuments({ _id: new ObjectId(id) })).toBe(1);
  });

  it("DELETE removes only the owner's row", async () => {
    const ownId = await insertRow(userId);
    const otherId = await insertRow(otherUserId);

    const response = await del(ownId);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    const rows = await getCollection("workouts");
    expect(await rows.countDocuments({ _id: new ObjectId(ownId) })).toBe(0);
    expect(await rows.countDocuments({ _id: new ObjectId(otherId) })).toBe(1);
  });

  it("DELETE reverses the workout's XP and total", async () => {
    const id = await insertRow(userId);
    await (await getCollection("xpLedger")).insertMany([
      { userId, sourceType: "workout", sourceId: id, amount: 1, occurredAt: originalDate, createdAt: originalDate },
      { userId, sourceType: "workout", sourceId: "older", amount: 749, occurredAt: originalDate, createdAt: originalDate },
    ] as never[]);

    expect((await del(id)).status).toBe(200);

    const after = await readProfile();
    expect(after?.totalXp).toBe(749);
    expect(after?.totalWorkouts).toBe(3);
  });
});

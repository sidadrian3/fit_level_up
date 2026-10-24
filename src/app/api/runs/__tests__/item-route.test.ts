import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import { PUT, DELETE } from "../[id]/route";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { getCollection, type PlayerProfileDoc } from "@/server/platform/database";
import { seedPlayer, deletePlayer } from "@/testing/players";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn(),
}));

const NOT_FOUND = "Run not found or invalid ID";
const unknownId = "64b7f0c2a1b2c3d4e5f60718";

const validBody = {
  distance: 5,
  duration: 30,
  difficulty: "moderate",
};

function put(id: string) {
  return PUT(
    new Request(`http://localhost:3000/api/runs/${id}`, { method: "PUT", body: JSON.stringify(validBody) }),
    { params: Promise.resolve({ id }) }
  );
}

function del(id: string) {
  return DELETE(new Request(`http://localhost:3000/api/runs/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

describe("/api/runs/[id]", () => {
  beforeAll(() => {
    vi.mocked(getAuthUserId).mockResolvedValue("run-item-route-user");
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

describe("/api/runs/[id] with stored rows", () => {
  const originalDate = new Date("2026-03-04T10:00:00Z");
  const startingProfile = { totalXp: 750, totalWorkouts: 4, totalDistance: 12.5, streak: 2 };
  let userId: string;
  let otherUserId: string;

  async function insertRow(owner: string): Promise<string> {
    const { insertedId } = await (await getCollection("runs")).insertOne({ userId: owner, distance: 2, duration: 10, pace: 5, difficulty: "easy" as const, xpEarned: 1, date: originalDate });
    return insertedId.toString();
  }

  async function readProfile() {
    return (await getCollection<PlayerProfileDoc>("playerProfiles")).findOne({ _id: userId });
  }

  beforeEach(async () => {
    userId = await seedPlayer({ email: `runs-item-${crypto.randomUUID()}@example.com`, name: "Owner", profile: startingProfile });
    otherUserId = await seedPlayer({ email: `runs-other-${crypto.randomUUID()}@example.com`, name: "Other" });
    vi.mocked(getAuthUserId).mockResolvedValue(userId);
  });

  afterEach(async () => {
    await (await getCollection("runs")).deleteMany({ userId: { $in: [userId, otherUserId] } });
    await deletePlayer(userId);
    await deletePlayer(otherUserId);
  });

  it("PUT recomputes xpEarned and keeps the original date", async () => {
    const id = await insertRow(userId);

    const response = await put(id);
    const updated = await response.json();

    expect(response.status).toBe(200);
    expect(updated).toMatchObject({ distance: 5, duration: 30, difficulty: "moderate", xpEarned: 132 });
    expect(updated.date).toBe(originalDate.toISOString());
    const stored = await (await getCollection("runs")).findOne({ _id: new ObjectId(id) });
    expect(stored).toMatchObject({ xpEarned: 132 });
    expect(stored?.date).toEqual(originalDate);
  });

  it("PUT returns 404 for another user's row and leaves it untouched", async () => {
    const id = await insertRow(otherUserId);

    const response = await put(id);

    expect(response.status).toBe(404);
    expect(await (await getCollection("runs")).findOne({ _id: new ObjectId(id) })).toMatchObject({ xpEarned: 1 });
  });

  it("DELETE returns 404 for another user's row and keeps it", async () => {
    const id = await insertRow(otherUserId);

    const response = await del(id);

    expect(response.status).toBe(404);
    expect(await (await getCollection("runs")).countDocuments({ _id: new ObjectId(id) })).toBe(1);
  });

  it("DELETE removes only the owner's row", async () => {
    const ownId = await insertRow(userId);
    const otherId = await insertRow(otherUserId);

    const response = await del(ownId);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    const rows = await getCollection("runs");
    expect(await rows.countDocuments({ _id: new ObjectId(ownId) })).toBe(0);
    expect(await rows.countDocuments({ _id: new ObjectId(otherId) })).toBe(1);
  });

  it("DELETE does not change the user's XP or totals", async () => {
    const id = await insertRow(userId);
    const before = await readProfile();

    expect((await del(id)).status).toBe(200);

    const after = await readProfile();
    expect(after).toMatchObject(startingProfile);
    expect(after).toEqual(before);
  });
});

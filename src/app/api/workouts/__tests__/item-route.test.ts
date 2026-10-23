import { describe, it, expect, vi, beforeAll } from "vitest";
import { PUT, DELETE } from "../[id]/route";
import { getAuthUserId } from "@/lib/auth/auth-helpers";

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

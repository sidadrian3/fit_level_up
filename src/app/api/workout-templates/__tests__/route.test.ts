import { describe, it, expect, vi } from "vitest";
import { DELETE } from "../[id]/route";

vi.mock("@/lib/auth/auth-helpers", () => ({
  getAuthUserId: vi.fn().mockResolvedValue("template-route-user"),
}));

describe("DELETE /api/workout-templates/[id]", () => {
  it("returns 404 for a malformed template id", async () => {
    const response = await DELETE(
      new Request("http://localhost:3000/api/workout-templates/abc", { method: "DELETE" }),
      { params: Promise.resolve({ id: "abc" }) }
    );

    expect(response.status).toBe(404);
  });
});

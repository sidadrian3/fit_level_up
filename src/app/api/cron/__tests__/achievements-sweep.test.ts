import { describe, it, expect } from "vitest";
import { GET } from "../achievements-sweep/route";

function sweep(authorization?: string) {
  return GET(new Request("http://localhost:3000/api/cron/achievements-sweep", {
    headers: authorization ? { authorization } : {},
  }));
}

describe("GET /api/cron/achievements-sweep", () => {
  it("returns 401 without a bearer token", async () => {
    expect((await sweep()).status).toBe(401);
  });

  it("returns 401 with the wrong token", async () => {
    expect((await sweep("Bearer wrong-token")).status).toBe(401);
  });

  it("runs the sweep with the configured secret", async () => {
    const response = await sweep(`Bearer ${process.env.CRON_SECRET}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true });
  });
});

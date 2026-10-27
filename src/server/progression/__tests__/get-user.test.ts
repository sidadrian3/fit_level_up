import { describe, it, expect, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import { getUser } from "../progression.service";
import { NotFoundError } from "@/server/platform/http";
import { deletePlayer, seedPlayer } from "@/testing/players";

describe("getUser", () => {
  const created: string[] = [];
  afterEach(async () => {
    await Promise.all(created.splice(0).map(deletePlayer));
  });

  it("merges the account with the player state", async () => {
    const userId = await seedPlayer({ name: "Ada", profile: { totalWorkouts: 4 } });
    created.push(userId);

    const user = await getUser(userId);

    expect(user).toMatchObject({ id: userId, name: "Ada", timeZone: "UTC", level: 1, totalWorkouts: 4 });
  });

  it("throws NotFoundError for an unknown user", async () => {
    await expect(getUser(new ObjectId().toString())).rejects.toBeInstanceOf(NotFoundError);
  });
});

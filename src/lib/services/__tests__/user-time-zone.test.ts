import { describe, it, expect, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import { auth } from "@/lib/auth/server";
import { getCollection, type UserDoc } from "@/server/platform/database";
import { getUserFromDb, getUserTimeZoneFromDb } from "@/lib/data/user-db";

describe("user time zone", () => {
  const createdEmails: string[] = [];
  const createdIds: ObjectId[] = [];

  afterEach(async () => {
    const users = await getCollection<UserDoc>("user");
    await users.deleteMany({
      $or: [{ email: { $in: createdEmails } }, { _id: { $in: createdIds } }],
    });
    createdEmails.length = 0;
    createdIds.length = 0;
  });

  function uniqueEmail() {
    const email = `tz-${crypto.randomUUID()}@example.com`;
    createdEmails.push(email);
    return email;
  }

  it("stores a valid timeZone sent at signup", async () => {
    const result = await auth.api.signUpEmail({
      body: { email: uniqueEmail(), password: "password-123", name: "TZ", timeZone: "Asia/Manila" },
    });

    expect(await getUserTimeZoneFromDb(result.user.id)).toBe("Asia/Manila");
  });

  it("rejects an invalid timeZone at signup", async () => {
    const email = uniqueEmail();

    await expect(
      auth.api.signUpEmail({
        body: { email, password: "password-123", name: "TZ", timeZone: "+08:00" },
      })
    ).rejects.toThrow();

    const users = await getCollection<UserDoc>("user");
    expect(await users.findOne({ email })).toBeNull();
  });

  it("reads UTC when the field is missing", async () => {
    const users = await getCollection<UserDoc>("user");
    const { insertedId } = await users.insertOne({
      email: uniqueEmail(),
      name: "No TZ",
      level: 1,
      xp: 0,
      xpToNextLevel: 500,
      streak: 0,
      totalWorkouts: 0,
      totalDistance: 0,
      stamina: 100,
      lastStaminaUpdate: new Date(),
      createdAt: new Date(),
    });
    createdIds.push(insertedId);

    expect(await getUserTimeZoneFromDb(insertedId.toString())).toBe("UTC");
    expect((await getUserFromDb(insertedId.toString()))?.timeZone).toBe("UTC");
  });
});

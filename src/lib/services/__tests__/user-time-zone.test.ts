import { describe, it, expect, afterEach } from "vitest";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import { auth, getAccount, getUserTimeZone } from "@/server/platform/auth";
import { getCollection, type UserDoc } from "@/server/platform/database";
import { getUserFromDb } from "@/lib/data/user-db";

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

    expect(await getUserTimeZone(result.user.id)).toBe("Asia/Manila");
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

    expect(await getUserTimeZone(insertedId.toString())).toBe("UTC");
    expect((await getUserFromDb(insertedId.toString()))?.timeZone).toBe("UTC");
  });

  it("getAccount returns identity fields only, defaulting timeZone to UTC", async () => {
    const users = await getCollection<UserDoc>("user");
    const email = uniqueEmail();
    const { insertedId } = await users.insertOne({
      email,
      name: "Acct",
      image: "bolt",
      level: 7,
      xp: 10,
      xpToNextLevel: 500,
      streak: 0,
      totalWorkouts: 0,
      totalDistance: 0,
      stamina: 100,
      lastStaminaUpdate: new Date(),
      createdAt: new Date("2025-03-04T10:00:00Z"),
    });
    createdIds.push(insertedId);

    expect(await getAccount(insertedId.toString())).toEqual({
      id: insertedId.toString(),
      email,
      name: "Acct",
      avatar: "bolt",
      joinDate: "2025-03-04",
      timeZone: "UTC",
    });
  });

  it("getAccount returns null and getUserTimeZone UTC for malformed or missing ids", async () => {
    expect(await getAccount("not-an-id")).toBeNull();
    expect(await getAccount(new ObjectId().toString())).toBeNull();
    expect(await getUserTimeZone("not-an-id")).toBe("UTC");
  });
});

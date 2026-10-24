import { ObjectId } from "mongodb";
import {
  getCollection,
  type PlayerProfileDoc,
  type UserDoc,
} from "@/server/platform/database";

type SeededUser = Pick<UserDoc, "email" | "name" | "createdAt" | "timeZone">;

export type SeedPlayerOptions = {
  name?: string;
  email?: string;
  timeZone?: string;
  createdAt?: Date;
  profile?: Partial<PlayerProfileDoc>;
};

export async function seedPlayer({
  name = "Test Player",
  email = `player-${new ObjectId().toHexString()}@example.com`,
  timeZone,
  createdAt = new Date(),
  profile,
}: SeedPlayerOptions = {}): Promise<string> {
  const users = await getCollection<SeededUser>("user");
  const { insertedId } = await users.insertOne({
    name,
    email,
    createdAt,
    timeZone,
  });
  const userId = insertedId.toString();

  if (profile) {
    const now = new Date();
    const profiles = await getCollection<PlayerProfileDoc>("playerProfiles");
    await profiles.insertOne({
      totalXp: 0,
      streak: 0,
      lastActivityDay: null,
      stamina: 100,
      lastStaminaUpdate: now,
      totalWorkouts: 0,
      totalDistance: 0,
      createdAt: now,
      updatedAt: now,
      ...profile,
      _id: userId,
    });
  }
  return userId;
}

export async function deletePlayer(userId: string): Promise<void> {
  await (
    await getCollection<SeededUser>("user")
  ).deleteOne({ _id: new ObjectId(userId) });
  await (
    await getCollection<PlayerProfileDoc>("playerProfiles")
  ).deleteOne({ _id: userId });
  await (
    await getCollection<{ userId: string }>("xpLedger")
  ).deleteMany({ userId });
}

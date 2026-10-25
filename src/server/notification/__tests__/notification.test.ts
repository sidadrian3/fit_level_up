import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ObjectId } from "mongodb";
import { getCollection, type FriendshipDoc, type NotificationDoc, type OutboxDoc } from "@/server/platform/database";
import { createDispatcher, emit } from "@/server/platform/events";
import { buildFriendshipPairKey } from "@/server/social";
import { deletePlayer, seedPlayer } from "@/testing/players";
import { inTransaction } from "@/testing/transactions";
import { listNotifications, markNotificationsRead, notificationListeners } from "../index";

const dispatcher = createDispatcher(notificationListeners);

async function emitAndDispatch(...emits: ((session: Parameters<typeof emit>[2]["session"]) => Promise<ObjectId>)[]) {
  const ids = await inTransaction(async (session) => {
    const created: ObjectId[] = [];
    for (const send of emits) created.push(await send(session));
    return created;
  });
  await dispatcher.dispatchOwnAndOverdue(ids);
  return ids;
}

async function seedFriendship(requesterId: string, receiverId: string, status: FriendshipDoc["status"]) {
  const now = new Date();
  const { insertedId } = await (await getCollection<FriendshipDoc>("friendships")).insertOne({
    requesterId, receiverId, pairKey: buildFriendshipPairKey(requesterId, receiverId), status, createdAt: now, updatedAt: now,
  });
  return insertedId.toString();
}

async function seedFeed(userId: string, count: number, readAt: Date | null = null) {
  const base = Date.parse("2026-01-01T00:00:00Z");
  const rows = Array.from({ length: count }, (_, index) => ({
    userId, sourceEventId: new ObjectId(), actor: null, createdAt: new Date(base + index * 1000), readAt,
    type: "achievement.unlocked" as const, data: { achievementId: `a${index}` },
  }));
  await (await getCollection("notifications")).insertMany(rows);
  return rows;
}

describe("notification", () => {
  let userId: string;
  let otherId: string;
  const playerIds: string[] = [];

  const rowsFor = async (recipientId: string) =>
    (await getCollection<NotificationDoc>("notifications")).find({ userId: recipientId }).toArray();

  beforeEach(async () => {
    await (await getCollection("outbox")).deleteMany({});
    userId = await seedPlayer({ name: "Alice" });
    otherId = await seedPlayer({ name: "Bob" });
    playerIds.push(userId, otherId);
  });

  afterEach(async () => {
    await (await getCollection("outbox")).deleteMany({});
    await (await getCollection("notifications")).deleteMany({ userId: { $in: playerIds } });
    await (await getCollection("friendships")).deleteMany({ requesterId: { $in: playerIds } });
    await Promise.all(playerIds.splice(0).map(deletePlayer));
  });

  describe("listeners", () => {
    it("friendship.requested writes one unread row to the receiver with the requester as actor", async () => {
      await emitAndDispatch((session) =>
        emit("friendship.requested", { friendshipId: "f1", requesterId: userId, receiverId: otherId }, { session }));

      expect(await rowsFor(userId)).toHaveLength(0);
      const rows = await rowsFor(otherId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        type: "friend.requested", data: { friendshipId: "f1" }, readAt: null,
        actor: { userId, name: "Alice" },
      });
    });

    it("friendship.accepted writes one row to the requester with the receiver as actor", async () => {
      await emitAndDispatch((session) =>
        emit("friendship.accepted", { friendshipId: "f2", requesterId: userId, receiverId: otherId }, { session }));

      const rows = await rowsFor(userId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: "friend.accepted", data: { friendshipId: "f2" }, actor: { userId: otherId, name: "Bob" } });
      expect(await rowsFor(otherId)).toHaveLength(0);
    });

    it("progression.leveled-up fans out only to accepted friends", async () => {
      const acceptedFriend = await seedPlayer({ name: "Accepted" });
      const pendingFriend = await seedPlayer({ name: "Pending" });
      const declinedFriend = await seedPlayer({ name: "Declined" });
      playerIds.push(acceptedFriend, pendingFriend, declinedFriend);
      await seedFriendship(userId, acceptedFriend, "accepted");
      await seedFriendship(pendingFriend, userId, "pending");
      await seedFriendship(userId, declinedFriend, "declined");

      await emitAndDispatch((session) =>
        emit("progression.leveled-up", { userId, previousLevel: 1, newLevel: 2 }, { session }));

      const rows = await rowsFor(acceptedFriend);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: "friend.leveled-up", data: { newLevel: 2 }, actor: { userId, name: "Alice" } });
      expect(await rowsFor(pendingFriend)).toHaveLength(0);
      expect(await rowsFor(declinedFriend)).toHaveLength(0);
    });

    it("progression.leveled-up writes nothing for a user with no friends", async () => {
      await emitAndDispatch((session) =>
        emit("progression.leveled-up", { userId, previousLevel: 1, newLevel: 2 }, { session }));

      expect(await (await getCollection("notifications")).countDocuments({ "data.newLevel": 2, "actor.userId": userId })).toBe(0);
    });

    it("achievement.unlocked writes one row to the user with no actor", async () => {
      await emitAndDispatch((session) =>
        emit("achievement.unlocked", { userId, achievementId: "first_workout" }, { session }));

      const rows = await rowsFor(userId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ type: "achievement.unlocked", actor: null, data: { achievementId: "first_workout" } });
    });

    it("redelivering the same event writes once per recipient", async () => {
      const [eventId] = await emitAndDispatch((session) =>
        emit("achievement.unlocked", { userId, achievementId: "first_workout" }, { session }));

      await (await getCollection<OutboxDoc>("outbox")).updateOne(
        { _id: eventId },
        { $set: { status: "pending", availableAt: new Date(), completedListeners: [] } },
      );
      await dispatcher.dispatchOwnAndOverdue([eventId]);

      expect(await rowsFor(userId)).toHaveLength(1);
    });
  });

  describe("listNotifications", () => {
    it("returns the latest 20 of 25, newest first, without since", async () => {
      await seedFeed(userId, 25);

      const { items } = await listNotifications(userId);

      expect(items).toHaveLength(20);
      expect(items[0]).toMatchObject({ data: { achievementId: "a24" } });
      expect(items[19]).toMatchObject({ data: { achievementId: "a5" } });
      expect(items[0]).not.toHaveProperty("sourceEventId");
      expect(items[0].id).toEqual(expect.any(String));
    });

    it("returns rows at or after since, inclusive", async () => {
      const rows = await seedFeed(userId, 25);

      const { items } = await listNotifications(userId, rows[22].createdAt);

      expect(items.map((item) => item.createdAt)).toEqual(rows.slice(22).reverse().map((row) => row.createdAt.toISOString()));
    });

    it("caps a since feed at 50 rows", async () => {
      const rows = await seedFeed(userId, 55);

      const { items } = await listNotifications(userId, rows[0].createdAt);

      expect(items).toHaveLength(50);
    });

    it("counts only unread rows, for the caller only", async () => {
      await seedFeed(userId, 3);
      await seedFeed(userId, 2, new Date());
      await seedFeed(otherId, 4);

      expect((await listNotifications(userId)).unreadCount).toBe(3);
    });
  });

  describe("markNotificationsRead", () => {
    it("marks the caller's listed rows and ignores another user's id", async () => {
      await seedFeed(userId, 2);
      await seedFeed(otherId, 1);
      const [mine] = (await listNotifications(userId)).items;
      const [theirs] = (await listNotifications(otherId)).items;

      const result = await markNotificationsRead(userId, { ids: [mine.id, theirs.id, "not-an-object-id"] });

      expect(result).toEqual({ unreadCount: 1 });
      expect((await listNotifications(otherId)).unreadCount).toBe(1);
    });

    it("marks everything read with all: true", async () => {
      await seedFeed(userId, 3);

      expect(await markNotificationsRead(userId, { all: true })).toEqual({ unreadCount: 0 });
    });
  });
});

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { ObjectId } from "mongodb";
import { getCollection, type FriendshipDoc } from "@/server/platform/database";
import { DomainError } from "@/server/platform/domain";
import { ConflictError, ForbiddenError, NotFoundError } from "@/server/platform/http";
import { seedPlayer, deletePlayer } from "@/testing/players";
import {
  acceptFriendRequest,
  buildFriendshipPairKey,
  declineFriendRequest,
  getAcceptedFriendIds,
  getFriendRecords,
  listFriendRequests,
  listFriends,
  removeFriend,
  sendFriendRequest,
} from "../index";

const DAY = 86_400_000;
const UNKNOWN_ID = "507f1f77bcf86cd799439011";
const OUTBOX_TYPES = ["friendship.requested", "friendship.accepted"];

describe("social", () => {
  let a: string;
  let b: string;
  let c: string;

  beforeAll(async () => {
    a = await seedPlayer({ name: "User A", profile: { totalXp: 0 } });
    b = await seedPlayer({ name: "User B", profile: { totalXp: 5000 } });
    c = await seedPlayer({ name: "User C" });
  });

  beforeEach(async () => {
    await clearData();
  });

  afterAll(async () => {
    await clearData();
    await Promise.all([a, b, c].map(deletePlayer));
  });

  async function clearData() {
    await (await getCollection("friendships")).deleteMany({ requesterId: { $in: [a, b, c] } });
    await (await getCollection("friendships")).deleteMany({ receiverId: { $in: [a, b, c] } });
    await (await getCollection("outbox")).deleteMany({ type: { $in: OUTBOX_TYPES } });
    await (await getCollection("workouts")).deleteMany({ userId: { $in: [a, b, c] } });
  }

  async function outboxRows(type: string) {
    return (await getCollection("outbox")).find({ type }).toArray();
  }

  async function storedPair(x: string, y: string) {
    return (await getCollection<FriendshipDoc>("friendships")).findOne({ pairKey: buildFriendshipPairKey(x, y) });
  }

  async function declineAt(requester: string, receiver: string, declinedAt: Date) {
    await sendFriendRequest(requester, receiver);
    await declineFriendRequest(requester, receiver);
    await (await getCollection<FriendshipDoc>("friendships")).updateOne(
      { pairKey: buildFriendshipPairKey(requester, receiver) },
      { $set: { updatedAt: declinedAt } },
    );
    await (await getCollection("outbox")).deleteMany({ type: { $in: OUTBOX_TYPES } });
  }

  describe("sendFriendRequest", () => {
    it("creates a pending friendship and emits friendship.requested", async () => {
      const result = await sendFriendRequest(a, b);

      expect(result).toMatchObject({ status: "pending", requesterId: a, receiverId: b });
      const rows = await outboxRows("friendship.requested");
      expect(rows.map((row) => row.payload)).toEqual([{ friendshipId: result.id, requesterId: a, receiverId: b }]);
    });

    it("throws for a self-request", async () => {
      const error = await sendFriendRequest(a, a).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).kind).toBe("invalid");
      expect((error as DomainError).message).toBe("Cannot send a friend request to yourself");
    });

    it("throws Friend request already sent on a duplicate from either side, with one event", async () => {
      await sendFriendRequest(a, b);

      await expect(sendFriendRequest(a, b)).rejects.toThrow(ConflictError);
      await expect(sendFriendRequest(b, a)).rejects.toThrow("Friend request already sent.");
      expect(await outboxRows("friendship.requested")).toHaveLength(1);
    });

    it("throws User not found for an unknown receiver", async () => {
      await expect(sendFriendRequest(a, UNKNOWN_ID)).rejects.toThrow(new NotFoundError("User not found."));
    });

    it("throws Requester not found for an unknown requester", async () => {
      await expect(sendFriendRequest(UNKNOWN_ID, a)).rejects.toThrow("Requester not found.");
    });

    it("rejects a re-send by the declined requester inside the cooldown with no new event", async () => {
      const now = new Date("2026-10-20T00:00:00.000Z");
      await declineAt(a, b, now);

      await expect(sendFriendRequest(a, b, new Date(now.getTime() + 7 * DAY - 1))).rejects.toThrow(
        new ConflictError("Friend request already sent."),
      );
      expect(await outboxRows("friendship.requested")).toHaveLength(0);
      expect((await storedPair(a, b))?.status).toBe("declined");
    });

    it("lets the decliner send inside the cooldown, with the roles swapped", async () => {
      const now = new Date("2026-10-20T00:00:00.000Z");
      await declineAt(a, b, now);

      const flipped = await sendFriendRequest(b, a, new Date(now.getTime() + 1));

      expect(flipped).toMatchObject({ status: "pending", requesterId: b, receiverId: a });
      expect(await (await getCollection("friendships")).countDocuments({ requesterId: { $in: [a, b] } })).toBe(1);
      expect(await outboxRows("friendship.requested")).toHaveLength(1);
    });

    it("lets the declined requester send again 7 days after the decline", async () => {
      const now = new Date("2026-10-20T00:00:00.000Z");
      await declineAt(a, b, now);

      const again = await sendFriendRequest(a, b, new Date(now.getTime() + 7 * DAY));

      expect(again).toMatchObject({ status: "pending", requesterId: a, receiverId: b });
    });

    it("creates exactly one friendship when both sides send concurrently", async () => {
      const results = await Promise.allSettled([sendFriendRequest(a, b), sendFriendRequest(b, a)]);

      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
      expect(rejected?.reason).toBeInstanceOf(ConflictError);
      expect(await (await getCollection("friendships")).countDocuments({ requesterId: { $in: [a, b] } })).toBe(1);
      expect(await outboxRows("friendship.requested")).toHaveLength(1);
    });
  });

  describe("acceptFriendRequest", () => {
    it("accepts, emits friendship.accepted and lists both parties as friends", async () => {
      const request = await sendFriendRequest(a, b);

      const accepted = await acceptFriendRequest(a, b);

      expect(accepted.status).toBe("accepted");
      const rows = await outboxRows("friendship.accepted");
      expect(rows.map((row) => row.payload)).toEqual([{ friendshipId: request.id, requesterId: a, receiverId: b }]);
      expect((await listFriends(a)).map((friend) => [friend.userId, friend.name])).toEqual([[b, "User B"]]);
      expect((await listFriends(b)).map((friend) => friend.userId)).toEqual([a]);
    });

    it("refuses the requester accepting their own request", async () => {
      await sendFriendRequest(a, b);

      await expect(acceptFriendRequest(b, a)).rejects.toThrow(ForbiddenError);
      expect(await outboxRows("friendship.accepted")).toHaveLength(0);
    });

    it("refuses accepting twice", async () => {
      await sendFriendRequest(a, b);
      await acceptFriendRequest(a, b);

      await expect(acceptFriendRequest(a, b)).rejects.toThrow("Friend request is not pending.");
      expect(await outboxRows("friendship.accepted")).toHaveLength(1);
    });

    it("throws not found when no request exists", async () => {
      await expect(acceptFriendRequest(UNKNOWN_ID, b)).rejects.toThrow("Friend request not found.");
    });
  });

  describe("declineFriendRequest", () => {
    it("declines silently and the pair is not a friendship", async () => {
      await sendFriendRequest(a, b);
      await (await getCollection("outbox")).deleteMany({ type: { $in: OUTBOX_TYPES } });

      const declined = await declineFriendRequest(a, b);

      expect(declined.status).toBe("declined");
      expect(await listFriends(a)).toEqual([]);
      expect(await outboxRows("friendship.accepted")).toHaveLength(0);
      expect(await outboxRows("friendship.requested")).toHaveLength(0);
    });

    it("refuses the requester declining their own request", async () => {
      await sendFriendRequest(a, b);

      await expect(declineFriendRequest(b, a)).rejects.toThrow(ForbiddenError);
    });

    it("refuses declining an accepted friendship", async () => {
      await sendFriendRequest(a, b);
      await acceptFriendRequest(a, b);

      await expect(declineFriendRequest(a, b)).rejects.toThrow("Friend request is not pending.");
    });
  });

  describe("removeFriend", () => {
    it("lets either side remove an accepted friendship", async () => {
      await sendFriendRequest(a, b);
      await acceptFriendRequest(a, b);
      expect(await removeFriend(b, a)).toEqual({ success: true });

      await sendFriendRequest(a, c);
      await acceptFriendRequest(a, c);
      expect(await removeFriend(a, c)).toEqual({ success: true });
    });

    it("lets either side cancel or dismiss a pending request", async () => {
      await sendFriendRequest(a, b);

      expect(await removeFriend(a, b)).toEqual({ success: true });
      expect(await storedPair(a, b)).toBeNull();
    });

    it("throws not found for an unknown id", async () => {
      await expect(removeFriend(UNKNOWN_ID, a)).rejects.toThrow("Friendship not found.");
    });

    it("throws not found when a third user tries to remove", async () => {
      await sendFriendRequest(a, b);

      await expect(removeFriend(a, c)).rejects.toThrow("Friendship not found.");
      expect(await storedPair(a, b)).not.toBeNull();
    });

    it("answers not found for the declined requester and keeps the document", async () => {
      await sendFriendRequest(a, b);
      await declineFriendRequest(a, b);

      await expect(removeFriend(b, a)).rejects.toThrow(new NotFoundError("Friendship not found."));
      expect((await storedPair(a, b))?.status).toBe("declined");
    });

    it("keeps the cooldown after a refused removal", async () => {
      await sendFriendRequest(a, b);
      await declineFriendRequest(a, b);
      await removeFriend(b, a).catch(() => undefined);

      await expect(sendFriendRequest(a, b)).rejects.toThrow("Friend request already sent.");
    });
  });

  describe("listFriendRequests", () => {
    it("returns incoming pending requests, newest first, without personalRecords", async () => {
      await sendFriendRequest(a, b, new Date("2026-10-20T00:00:00.000Z"));
      await sendFriendRequest(c, b, new Date("2026-10-21T00:00:00.000Z"));

      const requests = await listFriendRequests(b);

      expect(requests.map((request) => request.userId)).toEqual([c, a]);
      expect(requests[0]).not.toHaveProperty("personalRecords");
      expect(await listFriendRequests(a)).toEqual([]);
    });

    it("skips a requester whose account was deleted", async () => {
      const ghost = await seedPlayer({ name: "Ghost" });
      await sendFriendRequest(ghost, b);
      await sendFriendRequest(a, b);
      await deletePlayer(ghost);

      expect((await listFriendRequests(b)).map((request) => request.userId)).toEqual([a]);
      await (await getCollection("friendships")).deleteMany({ requesterId: ghost });
    });
  });

  describe("listFriends", () => {
    it("sorts by level descending and omits personalRecords", async () => {
      await sendFriendRequest(a, c);
      await acceptFriendRequest(a, c);
      await sendFriendRequest(b, c);
      await acceptFriendRequest(b, c);
      await sendFriendRequest(a, b);
      await acceptFriendRequest(a, b);

      const friends = await listFriends(c);

      expect(friends.map((friend) => friend.userId)).toEqual([b, a]);
      expect(friends[0].level).toBeGreaterThan(friends[1].level);
      expect(friends[0]).not.toHaveProperty("personalRecords");
      expect(friends[0].friendship.status).toBe("accepted");
    });

    it("skips a friend whose account was deleted", async () => {
      const ghost = await seedPlayer({ name: "Ghost" });
      await sendFriendRequest(ghost, a);
      await acceptFriendRequest(ghost, a);
      await sendFriendRequest(b, a);
      await acceptFriendRequest(b, a);
      await deletePlayer(ghost);

      expect((await listFriends(a)).map((friend) => friend.userId)).toEqual([b]);
      await (await getCollection("friendships")).deleteMany({ requesterId: ghost });
    });
  });

  describe("getFriendRecords", () => {
    it("returns the friend's records for an accepted pair", async () => {
      await (await getCollection("runs")).insertOne({
        _id: new ObjectId(), userId: b, distance: 12, duration: 60, pace: 5,
        difficulty: "moderate" as const, xpEarned: 50, date: new Date(),
      });
      await sendFriendRequest(a, b);
      await acceptFriendRequest(a, b);

      const records = await getFriendRecords(a, b);

      expect(records.length).toBeGreaterThan(0);
      expect(records.some((record) => record.type === "endurance")).toBe(true);
      await (await getCollection("runs")).deleteMany({ userId: b });
    });

    it("throws Friend not found for a stranger, a pending pair and a declined pair", async () => {
      await expect(getFriendRecords(a, c)).rejects.toThrow(new NotFoundError("Friend not found."));

      await sendFriendRequest(a, b);
      await expect(getFriendRecords(a, b)).rejects.toThrow("Friend not found.");

      await declineFriendRequest(a, b);
      await expect(getFriendRecords(a, b)).rejects.toThrow("Friend not found.");
      await expect(getFriendRecords(b, a)).rejects.toThrow("Friend not found.");
    });
  });

  describe("getAcceptedFriendIds", () => {
    it("returns accepted friends from both directions and excludes pending and declined pairs", async () => {
      await sendFriendRequest(a, b);
      await acceptFriendRequest(a, b);
      await sendFriendRequest(c, a);
      const ghost = await seedPlayer({ name: "Declined" });
      await sendFriendRequest(ghost, a);
      await declineFriendRequest(ghost, a);

      expect(await getAcceptedFriendIds(a)).toEqual([b]);
      expect(await getAcceptedFriendIds(b)).toEqual([a]);
      expect(await getAcceptedFriendIds(c)).toEqual([]);

      await (await getCollection("friendships")).deleteMany({ requesterId: ghost });
      await deletePlayer(ghost);
    });
  });
});

import { DomainError } from "@/server/platform/domain";

export type FriendshipStatus = "pending" | "accepted" | "declined";

export type FriendshipSnapshot = {
  requesterId: string;
  receiverId: string;
  status: FriendshipStatus;
  updatedAt: Date;
};

export type FriendshipAction = "accept" | "decline" | "remove" | "reopen";
export type TransitionVerdict = "ok" | "wrongState" | "notAllowed" | "coolingDown";

export const FRIENDSHIP_TRANSITIONS = {
  accept: { from: ["pending"], actor: "receiver" },
  decline: { from: ["pending"], actor: "receiver" },
  remove: { from: ["pending", "accepted"], actor: "participant" },
  reopen: { from: ["declined"], actor: "previousReceiver | requesterAfterCooldown" },
} as const satisfies Record<FriendshipAction, { from: readonly FriendshipStatus[]; actor: string }>;

const MS_PER_DAY = 86_400_000;

type Actor = { friendship: FriendshipSnapshot; actorId: string; now: Date; cooldownDays: number };

const ACTOR_CHECKS: Record<FriendshipAction, (actor: Actor) => TransitionVerdict> = {
  accept: ({ friendship, actorId }) => (friendship.receiverId === actorId ? "ok" : "notAllowed"),
  decline: ({ friendship, actorId }) => (friendship.receiverId === actorId ? "ok" : "notAllowed"),
  remove: ({ friendship, actorId }) =>
    friendship.requesterId === actorId || friendship.receiverId === actorId ? "ok" : "notAllowed",
  reopen: ({ friendship, actorId, now, cooldownDays }) => {
    if (friendship.receiverId === actorId) return "ok";
    if (friendship.requesterId !== actorId) return "notAllowed";
    const elapsedMs = now.getTime() - friendship.updatedAt.getTime();
    return elapsedMs < cooldownDays * MS_PER_DAY ? "coolingDown" : "ok";
  },
};

export function checkFriendshipTransition(
  action: FriendshipAction,
  friendship: FriendshipSnapshot,
  actorId: string,
  now: Date,
  cooldownDays: number,
): TransitionVerdict {
  const allowedStatuses: readonly FriendshipStatus[] = FRIENDSHIP_TRANSITIONS[action].from;
  if (!allowedStatuses.includes(friendship.status)) return "wrongState";
  return ACTOR_CHECKS[action]({ friendship, actorId, now, cooldownDays });
}

export function validateFriendRequest(requesterId: string, receiverId: string): void {
  if (!requesterId || !receiverId) {
    throw new DomainError("invalid", "Requester and receiver IDs are required");
  }
  if (requesterId === receiverId) {
    throw new DomainError("invalid", "Cannot send a friend request to yourself");
  }
}

export function buildFriendshipPairKey(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join(":");
}

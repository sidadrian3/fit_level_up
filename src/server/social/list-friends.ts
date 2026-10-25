import type { FriendProfile } from "@/lib/types";
import { getAccounts } from "@/server/platform/auth";
import { getPlayerStates } from "@/server/progression";
import { findAccepted, findIncomingPending, toFriendship } from "./friendship.repository";
import type { FriendshipDoc } from "@/server/platform/database";

function otherParty(friendship: FriendshipDoc, userId: string): string {
  return friendship.requesterId === userId ? friendship.receiverId : friendship.requesterId;
}

async function toProfiles(
  friendships: FriendshipDoc[],
  otherPartyId: (friendship: FriendshipDoc) => string,
): Promise<FriendProfile[]> {
  const accounts = await getAccounts(friendships.map(otherPartyId));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const playerById = await getPlayerStates(accounts.map((account) => ({ userId: account.id, timeZone: account.timeZone })));

  return friendships.flatMap((friendship) => {
    const account = accountById.get(otherPartyId(friendship));
    const player = account && playerById.get(account.id);
    if (!account || !player) return [];
    return {
      userId: account.id,
      name: account.name,
      avatar: account.avatar,
      level: player.level,
      streak: player.streak,
      totalWorkouts: player.totalWorkouts,
      totalDistance: player.totalDistance,
      friendship: toFriendship(friendship),
    };
  });
}

export async function listFriends(userId: string): Promise<FriendProfile[]> {
  const friendships = await findAccepted(userId);
  const profiles = await toProfiles(friendships, (friendship) => otherParty(friendship, userId));
  return profiles.sort((a, b) => b.level - a.level);
}

export async function listFriendRequests(userId: string): Promise<FriendProfile[]> {
  const requests = await findIncomingPending(userId);
  const profiles = await toProfiles(requests, (friendship) => friendship.requesterId);
  return profiles.sort((a, b) => b.friendship.createdAt.localeCompare(a.friendship.createdAt));
}

export async function getAcceptedFriendIds(userId: string): Promise<string[]> {
  const friendships = await findAccepted(userId);
  return friendships.map((friendship) => otherParty(friendship, userId));
}

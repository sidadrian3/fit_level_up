type FriendshipEvent = { friendshipId: string; requesterId: string; receiverId: string };

declare module "@/server/platform/events" {
  interface EventMap {
    "friendship.requested": FriendshipEvent;
    "friendship.accepted": FriendshipEvent;
  }
}

export {};

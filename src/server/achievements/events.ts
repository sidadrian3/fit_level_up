declare module "@/server/platform/events" {
  interface EventMap {
    "achievement.unlocked": { userId: string; achievementId: string };
  }
}

export {};

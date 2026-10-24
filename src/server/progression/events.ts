declare module "@/server/platform/events" {
  interface EventMap {
    "progression.leveled-up": { userId: string; previousLevel: number; newLevel: number };
  }
}

export {};

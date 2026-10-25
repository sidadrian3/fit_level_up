declare module "@/server/platform/events" {
  interface EventMap {
    "activity.logged": { userId: string; activity: { type: "workout" | "run"; id: string }; occurredAt: Date };
    "activity.reverted": { userId: string; activity: { type: "workout" | "run"; id: string } };
  }
}

export {};

export const questKeys = {
  all: ["quests"],
  list: () => [...questKeys.all, "list"],
} as const;

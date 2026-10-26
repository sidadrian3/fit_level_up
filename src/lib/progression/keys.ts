export const progressionKeys = {
  all: ["progression"],
  current: () => [...progressionKeys.all, "current"],
} as const;

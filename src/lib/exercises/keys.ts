export const exerciseKeys = {
  all: ["exercises"],
  custom: () => [...exerciseKeys.all, "custom"],
} as const;

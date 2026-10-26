export const templateKeys = {
  all: ["templates"],
  list: () => [...templateKeys.all, "list"],
} as const;

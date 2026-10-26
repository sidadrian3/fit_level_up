export const runKeys = {
  all: ["runs"],
  list: (page: number, limit: number) => [...runKeys.all, "list", { page, limit }],
  stats: () => [...runKeys.all, "stats"],
} as const;

export const friendKeys = {
  all: ["friends"],
  list: () => [...friendKeys.all, "list"],
  requests: () => [...friendKeys.all, "requests"],
  records: (friendId: string) => [...friendKeys.all, "records", friendId],
} as const;

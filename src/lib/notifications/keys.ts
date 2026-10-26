export const notificationKeys = {
  all: ["notifications"],
  feed: () => [...notificationKeys.all, "feed"],
  markRead: () => [...notificationKeys.all, "read"],
} as const;

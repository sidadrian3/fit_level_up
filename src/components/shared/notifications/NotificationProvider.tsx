"use client";

import { createContext, useContext } from "react";
import { useNotifications } from "@/lib/notifications/hooks/useNotifications";

type NotificationFeed = ReturnType<typeof useNotifications>;

const NotificationFeedContext = createContext<NotificationFeed | null>(null);

// One hook instance owns the poll, the toast state and the mutation-cache subscription; the bell, the sheet and the toast all read from it.
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const feed = useNotifications();
  return <NotificationFeedContext.Provider value={feed}>{children}</NotificationFeedContext.Provider>;
}

export function useNotificationFeed(): NotificationFeed {
  const feed = useContext(NotificationFeedContext);
  if (!feed) throw new Error("useNotificationFeed must be used inside NotificationProvider");
  return feed;
}

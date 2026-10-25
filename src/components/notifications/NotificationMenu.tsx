"use client";

import { useCallback, useRef, useState } from "react";
import { NotificationBell } from "./NotificationBell";
import { NotificationPanel } from "./NotificationPanel";
import { useNotificationFeed } from "./NotificationProvider";

export function NotificationMenu() {
  const { items, unreadCount, markRead, markAllRead } = useNotificationFeed();
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div ref={anchorRef} className="relative">
      <NotificationBell
        ref={bellRef}
        unreadCount={unreadCount}
        expanded={open}
        onOpen={() => setOpen((current) => !current)}
      />
      <NotificationPanel
        variant="popover"
        open={open}
        onClose={close}
        anchorRef={anchorRef}
        returnFocusRef={bellRef}
        items={items}
        unreadCount={unreadCount}
        markRead={markRead}
        markAllRead={markAllRead}
      />
    </div>
  );
}

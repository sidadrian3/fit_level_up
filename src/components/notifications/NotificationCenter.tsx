"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NotificationBell } from "./NotificationBell";
import { NotificationPanel } from "./NotificationPanel";
import { useNotificationFeed } from "./NotificationProvider";
import { NotificationToast } from "./NotificationToast";

const UNREAD_PREFIX_PATTERN = /^\(\d+\) /;

// Next rewrites <title> on navigation, so the prefix is re-applied when it changes.
function useUnreadTabTitle(unreadCount: number) {
  useEffect(() => {
    if (unreadCount === 0) return;
    const prefix = `(${unreadCount}) `;
    let baseTitle = document.title.replace(UNREAD_PREFIX_PATTERN, "");

    function applyPrefix() {
      if (document.title.startsWith(prefix)) return;
      baseTitle = document.title.replace(UNREAD_PREFIX_PATTERN, "");
      document.title = prefix + baseTitle;
    }

    applyPrefix();
    const observer = new MutationObserver(applyPrefix);
    observer.observe(document.head, { childList: true, characterData: true, subtree: true });
    return () => {
      observer.disconnect();
      document.title = baseTitle;
    };
  }, [unreadCount]);
}

export function NotificationCenter() {
  const { items, unreadCount, toastBatch, clearToast, markRead, markAllRead } =
    useNotificationFeed();
  const [panelOpen, setPanelOpen] = useState(false);
  const bellRef = useRef<HTMLButtonElement>(null);
  const closePanel = useCallback(() => setPanelOpen(false), []);

  useUnreadTabTitle(unreadCount);

  return (
    <>
      <div className="fixed right-4 top-[max(1rem,env(safe-area-inset-top))] z-40 lg:hidden">
        <NotificationBell
          ref={bellRef}
          unreadCount={unreadCount}
          expanded={panelOpen}
          onOpen={() => setPanelOpen(true)}
          className="border border-border bg-card"
        />
      </div>
      <NotificationPanel
        variant="sheet"
        open={panelOpen}
        onClose={closePanel}
        items={items}
        unreadCount={unreadCount}
        markRead={markRead}
        markAllRead={markAllRead}
      />
      {toastBatch.length > 0 && (
        <NotificationToast
          batch={toastBatch}
          onClose={clearToast}
          onOpenPanel={() => {
            clearToast();
            setPanelOpen(true);
          }}
        />
      )}
    </>
  );
}

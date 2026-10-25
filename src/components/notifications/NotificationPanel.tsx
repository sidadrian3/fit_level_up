"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { Notification } from "@/shared/contracts/notification";
import {
  describeNotification,
  formatRelativeTime,
} from "./notification-presentation";

const EXIT_MS = 150;
const CLOCK_TICK_MS = 30_000;

const POPOVER_BASE =
  "absolute left-0 top-full z-50 mt-2 w-80 origin-top-left overflow-hidden rounded-2xl border border-border bg-card shadow-lg transition-[opacity,scale,visibility] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:scale-100";
const POPOVER_OPEN = "visible scale-100 opacity-100 duration-[180ms]";
const POPOVER_CLOSED = "invisible scale-[0.97] opacity-0 duration-150";

const SHEET_BASE =
  "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-2xl border-t border-border bg-card p-0 text-foreground transition-[opacity,translate] ease-[cubic-bezier(0.32,0.72,0,1)] backdrop:bg-black/50 backdrop:transition-opacity lg:inset-x-auto lg:bottom-6 lg:right-6 lg:w-96 lg:rounded-2xl lg:border motion-reduce:translate-y-0";
const SHEET_OPEN = "translate-y-0 opacity-100 duration-[280ms] backdrop:opacity-100";
const SHEET_CLOSED = "translate-y-full opacity-0 duration-150 backdrop:opacity-0";

const ROW_CLASS =
  "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-card-hover focus-visible:bg-card-hover focus-visible:outline-none";

type PanelData = {
  items: Notification[];
  unreadCount: number;
  markRead: (ids: string[]) => void;
  markAllRead: () => void;
};

type PanelProps = PanelData & {
  open: boolean;
  onClose: () => void;
  variant: "popover" | "sheet";
  /** Element wrapping the bell and the popover; clicks inside it are not "outside". */
  anchorRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

function useMinuteClock(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function NotificationRow({
  notification,
  now,
  onSelect,
}: {
  notification: Notification;
  now: number;
  onSelect: (notification: Notification) => void;
}) {
  const { text, Icon, chipClass } = describeNotification(notification);
  const unread = notification.readAt === null;

  return (
    <li>
      <button type="button" className={ROW_CLASS} onClick={() => onSelect(notification)}>
        <span className="relative shrink-0">
          {notification.actor ? (
            <UserAvatar avatar={notification.actor.avatar} size="sm" />
          ) : null}
          <span
            className={`${notification.actor ? "absolute -bottom-1 -right-1 size-5" : "size-10"} flex items-center justify-center rounded-full ${chipClass}`}
          >
            <Icon className={notification.actor ? "size-3" : "size-5"} aria-hidden="true" />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`line-clamp-2 text-sm text-foreground ${unread ? "font-semibold" : "font-normal"}`}
          >
            {unread && <span className="sr-only">unread, </span>}
            {text}
          </span>
          <span className="text-xs text-muted">
            {formatRelativeTime(notification.createdAt, now)}
          </span>
        </span>
        <span
          aria-hidden="true"
          className={`mt-1.5 size-2 shrink-0 rounded-full bg-accent-green transition-opacity duration-150 ${unread ? "opacity-100" : "opacity-0"}`}
        />
      </button>
    </li>
  );
}

function PanelContent({
  items,
  unreadCount,
  markRead,
  markAllRead,
  onNavigate,
}: PanelData & { onNavigate: () => void }) {
  const router = useRouter();
  const now = useMinuteClock();

  function selectNotification(notification: Notification) {
    if (notification.readAt === null) markRead([notification.id]);
    onNavigate();
    router.push(describeNotification(notification).href);
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">Notifications</h2>
        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="min-h-11 rounded-lg px-2 text-sm font-medium text-accent-green hover:underline focus-visible:outline-2 focus-visible:outline-accent-green disabled:text-muted disabled:no-underline"
        >
          Mark all read
        </button>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted">You&apos;re all caught up</p>
      ) : (
        <ul className="max-h-[60dvh] divide-y divide-border overflow-y-auto overscroll-contain">
          {items.map((notification) => (
            <NotificationRow
              key={notification.id}
              notification={notification}
              now={now}
              onSelect={selectNotification}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function PopoverPanel({ open, onClose, anchorRef, returnFocusRef, ...data }: Omit<PanelProps, "variant">) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    function closeAndReturnFocus() {
      onClose();
      returnFocusRef?.current?.focus();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeAndReturnFocus();
    }
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef?.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open, onClose, anchorRef, returnFocusRef]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      tabIndex={-1}
      className={`${POPOVER_BASE} ${open ? POPOVER_OPEN : POPOVER_CLOSED} focus:outline-none`}
    >
      <PanelContent
        {...data}
        onNavigate={() => {
          onClose();
          returnFocusRef?.current?.focus();
        }}
      />
    </div>
  );
}

function SheetPanel({ open, onClose, ...data }: Omit<PanelProps, "variant" | "anchorRef" | "returnFocusRef">) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => {
        cancelAnimationFrame(frame);
        setEntered(false);
      };
    }
    const timer = setTimeout(() => {
      if (dialog.open) dialog.close();
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-label="Notifications"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
      className={`${SHEET_BASE} ${open && entered ? SHEET_OPEN : SHEET_CLOSED}`}
    >
      <PanelContent {...data} onNavigate={onClose} />
    </dialog>
  );
}

export function NotificationPanel({ variant, ...props }: PanelProps) {
  if (variant === "sheet") {
    return <SheetPanel {...props} />;
  }
  return <PopoverPanel {...props} />;
}

import type { Ref } from "react";
import { Bell } from "lucide-react";

const MAX_DISPLAYED_COUNT = 9;

const BUTTON_CLASS =
  "relative flex size-11 shrink-0 items-center justify-center rounded-xl text-muted active-press hover:bg-card-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-green";

const BADGE_CLASS =
  "absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-green px-1 text-[10px] font-bold leading-none text-background transition-[opacity,scale] duration-150 ease-out starting:scale-90 starting:opacity-0";

export function NotificationBell({
  unreadCount,
  onOpen,
  expanded,
  className = "",
  ref,
}: {
  unreadCount: number;
  onOpen: () => void;
  expanded: boolean;
  className?: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      aria-label={`Notifications, ${unreadCount} unread`}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      className={`${BUTTON_CLASS} ${className}`}
    >
      <Bell className="size-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span aria-hidden="true" className={BADGE_CLASS}>
          {unreadCount > MAX_DISPLAYED_COUNT ? `${MAX_DISPLAYED_COUNT}+` : unreadCount}
        </span>
      )}
    </button>
  );
}

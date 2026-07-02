import { UserAvatar } from "@/components/ui/UserAvatar";
import type { User } from "@/lib/types";

export function SidebarUserProfile({ user }: { user: User }) {
  const xpPercent = Math.round((user.xp / user.xpToNextLevel) * 100);

  return (
    <div className="p-6 border-b border-border">
      <div className="flex items-center gap-3 mb-3">
        <UserAvatar avatar={user.avatar} size="sm" />
        <div>
          <p className="font-semibold text-sm text-foreground">{user.name}</p>
          <p className="text-xs text-muted">Level {user.level}</p>
        </div>
      </div>

      {/* Mini XP bar */}
      <div className="w-full h-2 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-green rounded-full transition-all duration-500"
          style={{ width: `${xpPercent}%` }}
        />
      </div>
      <p className="text-xs text-muted mt-1">
        {user.xp} / {user.xpToNextLevel} XP
      </p>
    </div>
  );
}

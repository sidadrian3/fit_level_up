import { UserMinus } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { FriendProfile } from "@/lib/types";
import { useState } from "react";

interface FriendCardProps {
  friend: FriendProfile;
  onRemove: (id: string) => void;
  onViewProfile: () => void;
  isRemoving?: boolean;
}

export function FriendCard({ friend, onRemove, onViewProfile, isRemoving }: FriendCardProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div className="flex items-center justify-between p-4 bg-card/80 border border-border backdrop-blur-md rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
      <div 
        className="flex items-center gap-4 cursor-pointer group"
        onClick={onViewProfile}
      >
        <div className="transition-transform group-hover:scale-105">
          <UserAvatar avatar={friend.avatar} size="md" />
        </div>
        
        <div>
          <h3 className="font-bold text-foreground text-lg group-hover:text-accent-blue transition-colors">{friend.name}</h3>
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="bg-accent-purple/20 text-accent-purple px-2 py-0.5 rounded-full font-semibold">
              Lvl {friend.level}
            </span>
            <span> {friend.streak} Day Streak</span>
          </div>
        </div>
      </div>

      <div className="relative">
        {showConfirm ? (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground hover:bg-card-hover rounded-lg transition-colors"
              disabled={isRemoving}
            >
              Cancel
            </button>
            <button
              onClick={() => onRemove(friend.userId)}
              className="px-3 py-1.5 text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
              disabled={isRemoving}
            >
              {isRemoving ? "Removing..." : "Remove"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm(true)}
            className="p-2 text-muted hover:text-red-400 hover:bg-red-500/10 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500/50"
            aria-label="Remove Friend"
          >
            <UserMinus size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

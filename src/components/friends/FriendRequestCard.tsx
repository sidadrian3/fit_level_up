import { Check, X, Loader2 } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { FriendProfile } from "@/lib/types";

interface FriendRequestCardProps {
  request: FriendProfile;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  isProcessing?: boolean;
}

export function FriendRequestCard({
  request,
  onAccept,
  onDecline,
  isProcessing,
}: FriendRequestCardProps) {
  return (
    <div className="flex items-center justify-between p-4 bg-card border border-border backdrop-blur-md rounded-2xl shadow-sm transition-all duration-300 hover:shadow-md">
      <div className="flex items-center gap-4">
        <UserAvatar avatar={request.avatar} size="md" />
        
        <div>
          <h3 className="font-bold text-foreground text-lg">{request.name}</h3>
          <p className="text-sm text-muted font-medium">Wants to be your friend!</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onDecline(request.userId)}
          disabled={isProcessing}
          className="p-2.5 text-muted hover:text-foreground bg-card hover:bg-card-hover border border-border rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-border"
          aria-label="Decline Request"
        >
          <X size={20} />
        </button>
        <button
          onClick={() => onAccept(request.userId)}
          disabled={isProcessing}
          className="p-2.5 text-background bg-accent-green hover:brightness-110 rounded-xl transition-all duration-200 disabled:opacity-50 flex items-center justify-center shadow-lg shadow-accent-green/20 focus:outline-none focus:ring-2 focus:ring-accent-green/50"
          aria-label="Accept Request"
        >
          {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} strokeWidth={3} />}
        </button>
      </div>
    </div>
  );
}

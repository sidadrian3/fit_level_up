import { useEffect, useState } from "react";
import { Users, CheckCircle, ArrowUpCircle } from "lucide-react";
import type { SSEEvent } from "@/lib/sse/sse-types";
import { UserAvatar } from "@/components/ui/UserAvatar";

export function FriendToast({ event, onClose }: { event: SSEEvent; onClose: () => void }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300); // Wait for transition
        }, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    let icon, title, description, borderColor;

    if (event.type === "friend_request") {
        icon = <Users className="text-accent-blue absolute -bottom-1 -right-1 bg-card rounded-full" size={16} />;
        title = "New Friend Request";
        description = `${event.payload.actorName} sent a request!`;
        borderColor = "border-accent-blue";
    } else if (event.type === "friend_accepted") {
        icon = <CheckCircle className="text-accent-green absolute -bottom-1 -right-1 bg-card rounded-full" size={16} />;
        title = "Request Accepted";
        description = `${event.payload.actorName} accepted! `;
        borderColor = "border-accent-green";
    } else {
        icon = <ArrowUpCircle className="text-accent-purple absolute -bottom-1 -right-1 bg-card rounded-full" size={16} />;
        title = "Friend Level Up!";
        description = `${event.payload.actorName} reached Level ${event.payload.newLevel}! `;
        borderColor = "border-accent-purple";
    }

    return (
        <div className={`fixed bottom-24 right-4 z-50 flex items-center gap-3 p-4 bg-card border-2 ${borderColor} rounded-xl shadow-lg transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="relative">
                <UserAvatar avatar={event.payload.actorAvatar} size="md" />
                {icon}
            </div>
            <div>
                <h3 className="font-semibold text-foreground text-lg">{title}</h3>
                <p className="text-sm text-muted">{description}</p>
            </div>
            <button onClick={() => setVisible(false)} className="absolute top-2 right-2 text-muted hover:text-foreground">
                ×
            </button>
        </div>
    );
}

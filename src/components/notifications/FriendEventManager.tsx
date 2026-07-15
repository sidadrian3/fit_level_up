"use client";

import { useFriendEvents } from "@/lib/hooks/useFriendEvents";
import { FriendToast } from "./FriendToast";

export function FriendEventManager() {
    const { activeEvent, clearEvent } = useFriendEvents();

    if (!activeEvent) return null;

    return <FriendToast event={activeEvent} onClose={clearEvent} />;
}

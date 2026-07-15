import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SSEEvent } from "../sse/sse-types";

export function useFriendEvents() {
  const queryClient = useQueryClient();
  const [activeEvent, setActiveEvent] = useState<SSEEvent | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/friends/events");

    es.onmessage = (e) => {
      const event: SSEEvent = JSON.parse(e.data);

      switch (event.type) {
        case "friend_request":
          queryClient.invalidateQueries({ queryKey: ["friends", "requests"] });
          setActiveEvent(event);
          break;
        case "friend_accepted":
          queryClient.invalidateQueries({ queryKey: ["friends"] });
          setActiveEvent(event);
          break;
        case "friend_level_up":
          queryClient.invalidateQueries({ queryKey: ["friends"] });
          setActiveEvent(event);
          break;
        case "ping":
          // heartbeat — no action
          break;
      }
    };

    es.onerror = () => {
      console.warn("[SSE] Connection error, reconnecting...");
    };

    return () => es.close();
  }, [queryClient]);

  const clearEvent = () => setActiveEvent(null);

  return { activeEvent, clearEvent };
}

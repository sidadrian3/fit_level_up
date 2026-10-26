"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { friendKeys } from "@/lib/friends/keys";
import { getNotifications, markNotificationsRead } from "@/lib/data/api-client";
import type {
  MarkNotificationsReadInput,
  Notification,
} from "@/shared/contracts/notification";
import { NOTIFICATION_FEED_LIMIT } from "./constants";
import {
  extendFastWindow,
  mergeFeed,
  nextPollInterval,
  selectToastBatch,
} from "./notification-feed";

type Feed = { items: Notification[]; unreadCount: number };

const FEED_KEY = ["notifications"] as const;
const READ_MUTATION_KEY = ["notifications", "read"] as const;
const EMPTY_FEED: Feed = { items: [], unreadCount: 0 };

function markItemsRead(
  items: Notification[],
  input: MarkNotificationsReadInput,
): Notification[] {
  const readAt = new Date().toISOString();
  return items.map((item) => {
    const targeted = "all" in input || input.ids.includes(item.id);
    return targeted && item.readAt === null ? { ...item, readAt } : item;
  });
}

export function useNotifications(): {
  items: Notification[];
  unreadCount: number;
  toastBatch: Notification[];
  clearToast: () => void;
  markRead: (ids: string[]) => void;
  markAllRead: () => void;
} {
  const queryClient = useQueryClient();
  const fastUntilRef = useRef(0);
  const loadedAtRef = useRef<number | null>(null);
  const visibleSinceRef = useRef(0);
  const [toastBatch, setToastBatch] = useState<Notification[]>([]);

  useEffect(() => {
    visibleSinceRef.current = Date.now();
    function handleVisibility() {
      if (document.visibilityState === "visible")
        visibleSinceRef.current = Date.now();
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Listeners run in after(), so an immediate refetch can miss the entry; a bounded fast window is a known compromise (Known Issues: fast-poll window).
  useEffect(() => {
    return queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;
      if (event.mutation.options.mutationKey?.[0] === "notifications") return;
      fastUntilRef.current = Math.max(
        fastUntilRef.current,
        extendFastWindow(Date.now()),
      );
      void queryClient.refetchQueries({ queryKey: FEED_KEY });
    });
  }, [queryClient]);

  const { data = EMPTY_FEED } = useQuery<Feed>({
    queryKey: FEED_KEY,
    queryFn: async () => {
      const cached = queryClient.getQueryData<Feed>(FEED_KEY) ?? EMPTY_FEED;
      const response = await getNotifications(cached.items[0]?.createdAt);
      const knownIds = new Set(cached.items.map((item) => item.id));
      const arrived = response.items.filter((item) => !knownIds.has(item.id));

      if (loadedAtRef.current === null) {
        loadedAtRef.current = Date.now();
      } else {
        const batch = selectToastBatch(arrived, {
          loadedAt: loadedAtRef.current,
          visibleSince: visibleSinceRef.current,
        });
        if (batch.length > 0)
          setToastBatch((previous) => [...previous, ...batch]);
        if (arrived.some((item) => item.type.startsWith("friend."))) {
          void queryClient.invalidateQueries({ queryKey: friendKeys.all });
        }
      }

      return {
        items: mergeFeed(cached.items, response.items, NOTIFICATION_FEED_LIMIT),
        unreadCount: response.unreadCount,
      };
    },
    refetchInterval: () => nextPollInterval(Date.now(), fastUntilRef.current),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const readMutation = useMutation<
    { unreadCount: number },
    Error,
    MarkNotificationsReadInput,
    { previous: Feed }
  >({
    mutationKey: READ_MUTATION_KEY,
    mutationFn: markNotificationsRead,
    onMutate: (input) => {
      const previous = queryClient.getQueryData<Feed>(FEED_KEY) ?? EMPTY_FEED;
      queryClient.setQueryData<Feed>(FEED_KEY, (current = EMPTY_FEED) => {
        const items = markItemsRead(current.items, input);
        const newlyRead = current.items.filter(
          (item, index) => item.readAt === null && items[index].readAt !== null,
        );
        return {
          items,
          unreadCount: Math.max(0, current.unreadCount - newlyRead.length),
        };
      });
      return { previous };
    },
    onSuccess: ({ unreadCount }) => {
      queryClient.setQueryData<Feed>(FEED_KEY, (current = EMPTY_FEED) => ({
        ...current,
        unreadCount,
      }));
    },
    onError: (_error, _input, context) => {
      if (context) queryClient.setQueryData<Feed>(FEED_KEY, context.previous);
    },
  });

  const { mutate } = readMutation;
  const markRead = useCallback((ids: string[]) => mutate({ ids }), [mutate]);
  const markAllRead = useCallback(() => mutate({ all: true }), [mutate]);
  const clearToast = useCallback(() => setToastBatch([]), []);

  return {
    items: data.items,
    unreadCount: data.unreadCount,
    toastBatch,
    clearToast,
    markRead,
    markAllRead,
  };
}

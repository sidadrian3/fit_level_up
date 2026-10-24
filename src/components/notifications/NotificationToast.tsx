"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Notification } from "@/shared/contracts/notification";
import { describeNotification } from "./notification-presentation";

const TOAST_DURATION_MS = 5_000;
const EXIT_MS = 150;

const TOAST_BASE =
  "fixed bottom-24 right-4 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-border bg-card p-3 pr-2 shadow-lg transition-[opacity,translate] lg:bottom-6 motion-reduce:translate-y-0";
const TOAST_VISIBLE = "translate-y-0 opacity-100 duration-[250ms] ease-out";
const TOAST_HIDDEN = "translate-y-full opacity-0 duration-150 ease-out";

function useAutoDismiss(
  paused: boolean,
  restartKey: number,
  onElapsed: () => void,
) {
  const remainingRef = useRef(TOAST_DURATION_MS);
  const restartKeyRef = useRef(restartKey);
  const onElapsedRef = useRef(onElapsed);

  useEffect(() => {
    onElapsedRef.current = onElapsed;
  });

  useEffect(() => {
    if (restartKeyRef.current !== restartKey) {
      restartKeyRef.current = restartKey;
      remainingRef.current = TOAST_DURATION_MS;
    }
    if (paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => onElapsedRef.current(), remainingRef.current);
    return () => {
      clearTimeout(timer);
      remainingRef.current -= Date.now() - startedAt;
    };
  }, [paused, restartKey]);
}

export function NotificationToast({
  batch,
  onClose,
  onOpenPanel,
}: {
  batch: Notification[];
  onClose: () => void;
  onOpenPanel: () => void;
}) {
  const [entered, setEntered] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    function handleVisibility() {
      setTabHidden(document.visibilityState === "hidden");
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(onClose, EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving, onClose]);

  useAutoDismiss(hovered || tabHidden || leaving, batch.length, () => setLeaving(true));

  const single = batch.length === 1 ? describeNotification(batch[0]) : null;
  const message = single ? single.text : `${batch.length} new notifications`;

  return (
    <div
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${TOAST_BASE} ${entered && !leaving ? TOAST_VISIBLE : TOAST_HIDDEN}`}
    >
      <button
        type="button"
        onClick={single ? () => setLeaving(true) : onOpenPanel}
        className="flex min-h-11 items-center gap-3 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-accent-green"
      >
        {single && (
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${single.chipClass}`}>
            <single.Icon className="size-4" aria-hidden="true" />
          </span>
        )}
        <span className="text-sm font-medium text-foreground">{message}</span>
      </button>
      <button
        type="button"
        onClick={() => setLeaving(true)}
        aria-label="Dismiss notification"
        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted active-press hover:text-foreground"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

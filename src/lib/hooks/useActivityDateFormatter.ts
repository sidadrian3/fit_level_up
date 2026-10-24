"use client";

import { useCallback } from "react";
import { useUser } from "@/lib/context/UserContext";
import { formatActivityDate } from "@/lib/utils";
import { getBrowserTimeZone } from "@/lib/utils/browser-time-zone";

export function useActivityDateFormatter(): (isoInstant: string) => string {
  const { user } = useUser();
  const timeZone = user?.timeZone || getBrowserTimeZone() || "UTC";
  return useCallback((isoInstant) => formatActivityDate(isoInstant, timeZone), [timeZone]);
}

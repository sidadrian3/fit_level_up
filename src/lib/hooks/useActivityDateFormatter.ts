"use client";

import { useCallback } from "react";
import { useUser } from "@/lib/context/UserContext";
import { formatActivityDate } from "@/lib/utils";

export function useActivityDateFormatter(): (isoInstant: string) => string {
  const { user } = useUser();
  // UTC until the user loads keeps server and browser renders identical; an unset zone reads as UTC everywhere else too
  const timeZone = user?.timeZone || "UTC";
  return useCallback((isoInstant) => formatActivityDate(isoInstant, timeZone), [timeZone]);
}

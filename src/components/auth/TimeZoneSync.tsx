"use client";

import { useEffect, useRef } from "react";
import { authClient } from "@/lib/auth/client";
import { getBrowserTimeZone } from "@/lib/utils/browser-time-zone";

export function TimeZoneSync() {
    const { data } = authClient.useSession();
    const hasAttemptedSync = useRef(false);
    const user = data?.user;

    useEffect(() => {
        if (!user || user.timeZone || hasAttemptedSync.current) return;
        const timeZone = getBrowserTimeZone();
        if (!timeZone) return;

        hasAttemptedSync.current = true;
        authClient
            .updateUser({ timeZone })
            .then(({ error }) => {
                if (error) console.warn("Failed to sync time zone", error);
            })
            .catch((err: unknown) => {
                console.warn("Failed to sync time zone", err);
            });
    }, [user]);

    return null;
}

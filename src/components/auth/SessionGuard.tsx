"use client";

import { useEffect } from "react";
import { authClient } from "@/lib/auth/client";
import { useCurrentUser } from "@/lib/progression/hooks/useCurrentUser";

export function SessionGuard() {
    const { error } = useCurrentUser();

    useEffect(() => {
        if (error) {
            console.error("Failed to fetch user:", error);
            if (error instanceof Error && (error.message === "User not found" || error.message === "Unauthorized")) {
                void authClient.signOut().then(() => {
                    window.location.href = "/login";
                });
            }
        }
    }, [error]);

    return null;
}

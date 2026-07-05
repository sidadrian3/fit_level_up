"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User } from "@/lib/types";
import { apiFetch } from "@/lib/data/api-client/api-fetch";
import { authClient } from "@/lib/auth/client";

type UserContextType = {
    user: User | null;
    loading: boolean;
    refresh: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const data = await apiFetch<User>("/api/user");
            setUser(data);
        } catch (err) {
            console.error("Failed to refresh user:", err);
            if (err instanceof Error && (err.message === "User not found" || err.message === "Unauthorized")) {
                await authClient.signOut();
                window.location.href = "/login";
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Run once on mount
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void refresh();

        // Listen for updates from api-fetch
        const handleUpdate = () => refresh();
        window.addEventListener("user-updated", handleUpdate);
        
        return () => window.removeEventListener("user-updated", handleUpdate);
    }, [refresh]);

    return (
        <UserContext.Provider value={{ user, loading, refresh }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error("useUser must be used within a UserProvider");
    }
    return context;
}

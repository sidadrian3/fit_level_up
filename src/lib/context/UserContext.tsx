"use client";

import { createContext, useContext, useCallback, type ReactNode, useEffect } from "react";
import type { User } from "@/lib/types";
import { apiFetch } from "@/lib/data/api-client/api-fetch";
import { authClient } from "@/lib/auth/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type UserContextType = {
    user: User | null;
    loading: boolean;
    refresh: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();

    const { data: user = null, isLoading: loading, error } = useQuery<User>({
        queryKey: ["user"],
        queryFn: () => apiFetch<User>("/api/user"),
        retry: false,
    });

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

    const refresh = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: ["user"] });
    }, [queryClient]);

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

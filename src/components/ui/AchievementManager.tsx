"use client";

import { useEffect, useState, useRef } from "react";
import { getAchievements } from "@/lib/data/repositories";
import { AchievementToast } from "./AchievementToast";
import type { Achievement } from "@/lib/types";

export function AchievementManager() {
    const [newUnlock, setNewUnlock] = useState<Achievement | null>(null);
    const prevUnlockedIdsRef = useRef<Set<string> | null>(null);

    useEffect(() => {
        async function checkAchievements() {
            try {
                const achievements = await getAchievements();
                const unlocked = achievements.filter(a => a.unlocked);
                const currentUnlockedIds = new Set(unlocked.map(a => a.id));

                if (prevUnlockedIdsRef.current !== null) {
                    // Find any IDs that are in the new set but weren't in the old set
                    const newlyUnlocked = unlocked.filter(a => !prevUnlockedIdsRef.current!.has(a.id));

                    if (newlyUnlocked.length > 0) {
                        // Just show the first one if multiple unlocked at once (keeps UI simple)
                        setNewUnlock(newlyUnlocked[0]);
                    }
                }

                prevUnlockedIdsRef.current = currentUnlockedIds;
            } catch (err) {
                console.error("Failed to check achievements", err);
            }
        }

        // Check on mount
        checkAchievements();

        // Check when user data is updated
        const handleUserUpdate = () => checkAchievements();
        window.addEventListener("user-updated", handleUserUpdate);

        return () => window.removeEventListener("user-updated", handleUserUpdate);
    }, []);

    if (!newUnlock) return null;

    return (
        <AchievementToast
            achievement={newUnlock}
            onClose={() => setNewUnlock(null)}
        />
    );
}

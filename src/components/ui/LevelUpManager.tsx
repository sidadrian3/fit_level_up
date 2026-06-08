"use client";

import { useEffect, useState, useRef } from "react";
import { getUser } from "@/lib/data/repositories";
import { LevelUpToast } from "./LevelUpToast";

export function LevelUpManager() {
    const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);
    const prevLevelRef = useRef<number | null>(null);

    useEffect(() => {
        async function checkLevel() {
            try {
                const user = await getUser();
                
                if (prevLevelRef.current !== null && user.level > prevLevelRef.current) {
                    setLevelUpData({ level: user.level });
                }
                
                prevLevelRef.current = user.level;
            } catch (err) {
                console.error("Failed to check user level", err);
            }
        }

        // Check on mount
        checkLevel();

        // Check when user data is updated
        const handleUserUpdate = () => checkLevel();
        window.addEventListener("user-updated", handleUserUpdate);
        
        return () => window.removeEventListener("user-updated", handleUserUpdate);
    }, []);

    if (!levelUpData) return null;

    return (
        <LevelUpToast 
            level={levelUpData.level} 
            onClose={() => setLevelUpData(null)} 
        />
    );
}

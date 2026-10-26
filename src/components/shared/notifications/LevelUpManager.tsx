"use client";

import { useEffect, useState, useRef } from "react";
import { LevelUpToast } from "./LevelUpToast";
import { useCurrentUser } from "@/lib/progression/hooks/useCurrentUser";

export function LevelUpManager() {
    const { user } = useCurrentUser();
    const [levelUpData, setLevelUpData] = useState<{ level: number } | null>(null);
    const prevLevelRef = useRef<number | null>(null);

    useEffect(() => {
        if (!user) return;
        if (prevLevelRef.current !== null && user.level > prevLevelRef.current) {
            setLevelUpData({ level: user.level });
        }
        prevLevelRef.current = user.level;
    }, [user]);
    if (!levelUpData) return null;

    return (
        <LevelUpToast
            level={levelUpData.level}
            onClose={() => setLevelUpData(null)}
        />
    );
}

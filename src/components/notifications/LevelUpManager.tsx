"use client";

import { useEffect, useState, useRef } from "react";
import { LevelUpToast } from "./LevelUpToast";
import { useUser } from "@/lib/context/UserContext";

export function LevelUpManager() {
    const { user } = useUser();
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

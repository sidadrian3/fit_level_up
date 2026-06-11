import React from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { calcXPPercent } from "@/lib/utils";
import type { User } from "@/lib/types";

export interface XPCardProps {
    user: User;
}

export function XPCard({ user }: XPCardProps) {
    // Pure UI component - it just renders the data it's given

    return (
        <Card className="flex flex-col justify-center h-full">
            <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-2xl bg-accent-green/20 flex items-center justify-center text-3xl shrink-0 overflow-hidden">
                    {user.avatar?.startsWith('http') ? (
                        <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        user.avatar
                    )}
                </div>
                <div>
                    <h3 className="text-xl font-semibold tracking-tight text-foreground">Level {user.level}</h3>
                    <p className="text-sm text-muted">Keep grinding! You're doing great.</p>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                    <span className="text-foreground">{user.xp.toLocaleString()} XP</span>
                    <span className="text-muted">{user.xpToNextLevel.toLocaleString()} XP</span>
                </div>

                {/* Reusing our accessible, animated Progress Bar */}
                <ProgressBar value={user.xp} max={user.xpToNextLevel} />

                <p className="text-xs text-muted text-right mt-1">
                    {(user.xpToNextLevel - user.xp).toLocaleString()} XP to Level {user.level + 1}
                </p>
            </div>
        </Card>
    );
}

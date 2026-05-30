import React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Achievement } from "@/lib/types";

export interface AchievementGridProps {
    achievements: readonly Achievement[];
    className?: string;
}

/**
 * Displays a grid of achievement badges.
 */
export function AchievementGrid({ achievements, className = "" }: AchievementGridProps) {
    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const totalCount = achievements.length;

    return (
        <Card className={`flex flex-col gap-6 ${className}`}>
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-foreground">Achievements</h2>
                <div className="text-sm font-medium text-muted bg-background px-3 py-1 rounded-full border border-border">
                    {unlockedCount} / {totalCount} Unlocked
                </div>
            </div>

            {achievements.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {achievements.map((achievement) => (
                        <Badge key={achievement.id} achievement={achievement} />
                    ))}
                </div>
            ) : (
                <EmptyState 
                    icon="🏆" 
                    title="No achievements yet" 
                    description="Keep working out to unlock your first achievement!" 
                />
            )}
        </Card>
    );
}

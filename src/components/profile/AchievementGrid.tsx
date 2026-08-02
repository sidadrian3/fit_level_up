import React from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Achievement } from "@/lib/types";
import { Trophy } from "lucide-react";

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
        <Card className={`p-0 overflow-hidden ${className}`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border-b border-border bg-background/30 gap-4">
                <h2 className="text-3xl font-display font-bold uppercase tracking-tight text-foreground flex items-center gap-3">
                    <Trophy className="text-accent-purple" size={28} />
                    Achievements
                </h2>
                <div className="inline-flex items-center gap-2 bg-accent-purple/10 px-4 py-1.5 border border-accent-purple/20">
                    <span className="font-display font-bold text-xl uppercase tracking-wider text-accent-purple leading-none">
                        {unlockedCount} <span className="text-muted text-base">/ {totalCount}</span>
                    </span>
                    <span className="text-[10px] font-bold text-accent-purple uppercase tracking-widest mt-0.5">Unlocked</span>
                </div>
            </div>

            {achievements.length > 0 ? (
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {achievements.map((achievement) => (
                        <Badge key={achievement.id} achievement={achievement} />
                    ))}
                </div>
            ) : (
                <div className="p-8">
                    <EmptyState 
                        icon={<Trophy className="w-16 h-16 text-accent-purple" />} 
                        title="No achievements yet" 
                        description="Keep working out to unlock your first achievement!" 
                    />
                </div>
            )}
        </Card>
    );
}

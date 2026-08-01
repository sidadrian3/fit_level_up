import React from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { calcXPPercent, formatDate } from "@/lib/utils";
import type { User, DashboardStats } from "@/lib/types";
import { Dumbbell, MapPin, Zap, Flame, Trophy } from "lucide-react";
import { UserAvatar } from "@/components/ui/UserAvatar";

export interface ProfileHeaderProps {
    user: User;
    stats: DashboardStats;
    className?: string;
}

/**
 * Top profile section showing avatar, level, XP progress, and lifetime stats.
 */
export function ProfileHeader({ user, stats, className = "" }: ProfileHeaderProps) {
    const xpPercent = calcXPPercent(user.xp, user.xpToNextLevel);

    return (
        <Card className={`p-0 overflow-hidden ${className}`}>
            {/* Top section: Centered stack to fit perfectly in 1/3 col layouts */}
            <div className="flex flex-col items-center p-8 text-center">
                {/* Avatar with athletic styling */}
                <div className="relative shrink-0 mb-6">
                    <div className="absolute inset-0 bg-accent-purple/20 blur-xl rounded-full" />
                    <div className="relative border-2 border-border rounded-2xl overflow-hidden bg-background">
                        <UserAvatar avatar={user.avatar} size="lg" />
                    </div>
                </div>

                {/* Identity & Level */}
                <h2 className="text-5xl font-display font-bold uppercase tracking-tight text-foreground leading-none mb-3">
                    {user.name}
                </h2>
                
                <div className="inline-flex items-center justify-center gap-2 bg-accent-purple/10 px-4 py-1.5 border border-accent-purple/20 rounded-full mb-3">
                    <Trophy className="text-accent-purple" size={16} />
                    <span className="font-display font-bold text-lg uppercase tracking-wider text-accent-purple pt-0.5">
                        Level {user.level}
                    </span>
                </div>

                <p className="text-sm font-medium text-muted mb-8">
                    Member since {formatDate(user.joinDate)}
                </p>

                {/* XP Bar */}
                <div className="w-full space-y-3">
                    <div className="flex justify-between items-end">
                        <span className="text-xs font-bold uppercase tracking-widest text-muted">XP Progress</span>
                        <span className="font-display font-bold text-xl tracking-tight text-foreground leading-none">
                            {user.xp.toLocaleString()} <span className="text-muted text-base">/ {user.xpToNextLevel.toLocaleString()}</span>
                        </span>
                    </div>
                    <ProgressBar value={user.xp} max={user.xpToNextLevel} colorClass="bg-accent-purple" />
                </div>
            </div>

            {/* Lifetime Stats Grid - 2x2 HUD Style for narrow column support */}
            <div className="grid grid-cols-2 border-t border-border bg-background/30 divide-x divide-y divide-border">
                <div className="flex flex-col items-center justify-center p-6 text-center hover:bg-background/80 transition-colors">
                    <Dumbbell className="text-accent-orange mb-3" size={24} />
                    <span className="text-4xl font-display font-bold tracking-tight text-foreground leading-none mb-1">{user.totalWorkouts}</span>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Workouts</span>
                </div>
                <div className="flex flex-col items-center justify-center p-6 text-center hover:bg-background/80 transition-colors">
                    <MapPin className="text-accent-blue mb-3" size={24} />
                    <span className="text-4xl font-display font-bold tracking-tight text-foreground leading-none mb-1">{user.totalDistance}</span>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Kilometers</span>
                </div>
                <div className="flex flex-col items-center justify-center p-6 text-center hover:bg-background/80 transition-colors">
                    <Zap className="text-accent-green mb-3" size={24} />
                    <span className="text-4xl font-display font-bold tracking-tight text-foreground leading-none mb-1">{stats.lifetimeXP.toLocaleString()}</span>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Lifetime XP</span>
                </div>
                <div className="flex flex-col items-center justify-center p-6 text-center hover:bg-background/80 transition-colors">
                    <Flame className="text-accent-red mb-3" size={24} />
                    <span className="text-4xl font-display font-bold tracking-tight text-foreground leading-none mb-1">{user.streak}</span>
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Day Streak</span>
                </div>
            </div>
        </Card>
    );
}

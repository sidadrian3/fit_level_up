import React from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { calcXPPercent, formatDate } from "@/lib/utils";
import type { User, DashboardStats } from "@/lib/types";
import { Dumbbell, MapPin, Zap, Flame } from "lucide-react";
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
        <Card className={`p-8 ${className}`}>
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Avatar */}
                <UserAvatar avatar={user.avatar} size="lg" />

                {/* Info & XP */}
                <div className="flex-1 w-full text-center md:text-left">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
                        <div>
                            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                                {user.name}
                            </h2>
                            <p className="text-sm text-muted">
                                Member since {formatDate(user.joinDate)}
                            </p>
                        </div>
                        <div className="inline-flex items-center gap-2 bg-accent-purple/10 px-3 py-1.5 rounded-lg border border-accent-purple/20 mx-auto md:mx-0">
                            <span className="text-xl">👑</span>
                            <span className="font-semibold text-accent-purple">Level {user.level}</span>
                        </div>
                    </div>

                    {/* XP Bar */}
                    <div className="space-y-2 mt-4">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted">XP Progress</span>
                            <span className="font-medium text-foreground">
                                {user.xp.toLocaleString()} / {user.xpToNextLevel.toLocaleString()} XP
                            </span>
                        </div>
                        <ProgressBar value={user.xp} max={user.xpToNextLevel} colorClass="bg-accent-purple" />
                    </div>
                </div>
            </div>

            {/* Lifetime Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-8 border-t border-border">
                <div className="flex flex-col items-center p-3 rounded-lg bg-background border border-border">
                    <Dumbbell className="text-accent-orange mb-2" size={20} />
                    <span className="text-xl font-semibold tracking-tight text-foreground">{user.totalWorkouts}</span>
                    <span className="text-xs text-muted">Workouts</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-background border border-border">
                    <MapPin className="text-accent-blue mb-2" size={20} />
                    <span className="text-xl font-semibold tracking-tight text-foreground">{user.totalDistance}</span>
                    <span className="text-xs text-muted">Kilometers</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-background border border-border">
                    <Zap className="text-accent-green mb-2" size={20} />
                    <span className="text-xl font-semibold tracking-tight text-foreground">{stats.lifetimeXP.toLocaleString()}</span>
                    <span className="text-xs text-muted">Lifetime XP</span>
                </div>
                <div className="flex flex-col items-center p-3 rounded-lg bg-background border border-border">
                    <Flame className="text-accent-red mb-2" size={20} />
                    <span className="text-xl font-semibold tracking-tight text-foreground">{user.streak}</span>
                    <span className="text-xs text-muted">Day Streak</span>
                </div>
            </div>
        </Card>
    );
}

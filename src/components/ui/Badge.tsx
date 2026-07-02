import React from "react";
import type { Achievement } from "@/lib/types";
import { Trophy } from "lucide-react";
import { AchievementIconMap } from "@/lib/constants/achievement-icons";

export interface BadgeProps {
    achievement: Achievement;
    className?: string;
}

// Pre-define rarity color palettes
const rarityColors: Record<Achievement["rarity"], { bg: string; text: string; border: string }> = {
    common: { bg: "bg-border/20", text: "text-muted", border: "border-border" },
    rare: { bg: "bg-accent-blue/10", text: "text-accent-blue", border: "border-accent-blue/30" },
    epic: { bg: "bg-accent-purple/10", text: "text-accent-purple", border: "border-accent-purple/30" },
    legendary: { bg: "bg-accent-orange/10", text: "text-accent-orange", border: "border-accent-orange/30" },
};

export function Badge({ achievement, className = "" }: BadgeProps) {
    const { title, description, icon, rarity, unlocked } = achievement;
    const colors = rarityColors[rarity];

    return (
        <div 
            className={`flex flex-col items-center text-center p-4 rounded-xl border transition-default ${
                unlocked 
                    ? `${colors.bg} ${colors.border}` 
                    : "bg-card border-border opacity-50 grayscale"
            } ${className}`}
            aria-label={`${title} achievement, ${unlocked ? 'Unlocked' : 'Locked'}`}
        >
            <div className="mb-3 flex justify-center text-foreground">
                {(() => {
                    const Icon = AchievementIconMap[icon] || Trophy;
                    return <Icon className="w-8 h-8" />;
                })()}
            </div>
            <h4 className="font-semibold text-foreground text-sm mb-1">{title}</h4>
            <p className="text-xs text-muted mb-3 flex-1">{description}</p>
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full ${
                unlocked ? `${colors.bg} ${colors.text}` : "bg-border text-muted"
            }`}>
                {rarity}
            </span>
        </div>
    );
}

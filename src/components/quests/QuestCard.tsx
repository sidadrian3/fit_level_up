import React from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Quest } from "@/lib/types";
import { CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";

export interface QuestCardProps {
    quest: Quest;
    className?: string;
    onClaim?: (id: string) => void;
}

/**
 * Displays a single quest with progress/completion state.
 */
export function QuestCard({ quest, className = "", onClaim }: QuestCardProps) {

    const [isClaiming, setIsClaiming] = useState(false);
    const isCompleted = quest.completed;

    return (
        <Card
            className={`flex flex-col gap-4 transition-all duration-200 ${isCompleted
                ? "opacity-60 bg-card/50 border-border/50"
                : "hover:border-accent-green/30 hover:scale-[1.01]"
                } ${className}`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <div className="text-3xl shrink-0 leading-none mt-1">
                        {quest.icon}
                    </div>
                    <div>
                        <h4 className={`font-semibold ${isCompleted ? "line-through text-muted" : "text-foreground"}`}>
                            {quest.title}
                        </h4>
                        <p className="text-sm text-muted mt-1">
                            {quest.description}
                        </p>
                    </div>
                </div>

                <div className="shrink-0 flex items-center justify-center font-semibold text-xs bg-accent-green/10 text-accent-green px-2.5 py-1 rounded-full whitespace-nowrap">
                    +{quest.xpReward} XP
                </div>
            </div>

            <div className="mt-auto pt-2">
                {isCompleted ? (
                    quest.claimed ? (
                        <div className="flex items-center gap-2 text-accent-green font-semibold text-sm">
                            <CheckCircle size={16} />
                            <span>Claimed ✓</span>
                        </div>
                    ) : (
                        <button
                            onClick={async () => {
                                setIsClaiming(true);
                                await onClaim?.(quest.id);
                                setIsClaiming(false);
                            }}
                            disabled={isClaiming}
                            className="rounded-md bg-accent-green px-3 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {isClaiming ? "Claiming..." : `Claim ${quest.xpReward} XP`}
                        </button>
                    )
                ) : (
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted">
                            <span>Progress</span>
                            <span>{quest.progress} / {quest.target}</span>
                        </div>

                        <ProgressBar
                            value={quest.progress}
                            max={quest.target}
                            colorClass="bg-accent-green"
                        />
                    </div>
                )}
            </div>
        </Card>
    );
}

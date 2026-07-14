import React from "react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Quest } from "@/lib/types";
import { CheckCircle2, Target } from "lucide-react";
import { QuestIconMap } from "@/lib/constants/quest-icons";

export interface DailyQuestsProps {
    quests: readonly Quest[];
    className?: string;
}

export function DailyQuests({ quests, className = "" }: DailyQuestsProps) {
    if (!quests || quests.length === 0) {
        return (
            <Card className={className}>
                <h3 className="text-lg font-semibold text-foreground mb-4">Daily Quests</h3>
                <p className="text-sm text-muted text-center py-4">No daily quests available.</p>
            </Card>
        );
    }

    return (
        <Card className={`flex flex-col gap-4 ${className}`}>
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-foreground">Daily Quests</h3>
                <span className="text-xs text-muted">{quests.filter(q => q.completed).length}/{quests.length} completed</span>
            </div>
            <div className="space-y-4">
                {quests.map((quest) => {
                    const Icon = QuestIconMap[quest.icon] || Target;
                    return (
                    <div key={quest.id} className="flex gap-4 p-3 rounded-lg border border-border bg-background hover:bg-card-hover transition-default group">
                        <div className="text-2xl pt-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <Icon size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-semibold text-foreground truncate pr-2">{quest.title}</h4>
                                <span className="text-xs font-semibold text-accent-green whitespace-nowrap px-2 py-0.5 rounded bg-accent-green/10">
                                    +{quest.xpReward} XP
                                </span>
                            </div>
                            <p className="text-xs text-muted truncate mb-2">{quest.description}</p>

                            {quest.completed ? (
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-accent-green">
                                    <CheckCircle2 size={14} />
                                    <span>Completed</span>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] text-muted">
                                        <span>Progress</span>
                                        <span>{quest.progress} / {quest.target}</span>
                                    </div>
                                    <ProgressBar value={quest.progress} max={quest.target} />
                                </div>
                            )}
                        </div>
                    </div>
                    );
                })}
            </div>
        </Card>
    );
}

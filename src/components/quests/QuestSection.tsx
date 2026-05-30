import React from "react";
import { QuestCard } from "./QuestCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Quest } from "@/lib/types";

export interface QuestSectionProps {
    title: string;
    quests: readonly Quest[];
    icon?: React.ReactNode;
    className?: string;
}

/**
 * Groups quests by category and renders a grid of QuestCards.
 */
export function QuestSection({ title, quests, icon, className = "" }: QuestSectionProps) {
    return (
        <section className={className}>
            <div className="flex items-center gap-2 mb-4">
                {icon && <span className="text-accent-green">{icon}</span>}
                <h2 className="text-xl font-bold text-foreground">{title}</h2>
            </div>
            
            {quests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {quests.map((quest) => (
                        <QuestCard key={quest.id} quest={quest} />
                    ))}
                </div>
            ) : (
                <EmptyState 
                    icon="🎯" 
                    title={`No ${title.toLowerCase()}`}
                    description="Check back later for new challenges!"
                />
            )}
        </section>
    );
}

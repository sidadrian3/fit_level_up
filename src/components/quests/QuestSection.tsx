import React from "react";
import { QuestCard } from "./QuestCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Quest } from "@/lib/types";
import { Target } from "lucide-react";

export interface QuestSectionProps {
    title: string;
    quests: readonly Quest[];
    icon?: React.ReactNode;
    className?: string;
    onClaim?: (id: string) => void;
}

/**
 * Groups quests by category and renders a grid of QuestCards.
 */
export function QuestSection({ title, quests, icon, className = "", onClaim }: QuestSectionProps) {
    return (
        <section className={className}>
            <div className="flex items-center gap-2 mb-4">
                {icon && <span className="text-accent-green">{icon}</span>}
                <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
            </div>
            
            {quests.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {quests.map((quest) => (
                        <QuestCard key={quest.id} quest={quest} onClaim={onClaim} />
                    ))}
                </div>
            ) : (
                <EmptyState 
                    icon={<Target className="w-12 h-12" />} 
                    title={`No ${title.toLowerCase()}`}
                    description="Check back later for new challenges!"
                />
            )}
        </section>
    );
}

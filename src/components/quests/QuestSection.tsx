import React from "react";
import { Card } from "@/components/ui/Card";
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
export function QuestSection({
  title,
  quests,
  icon,
  className = "",
  onClaim,
}: QuestSectionProps) {
  return (
    <Card className={`p-0 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between p-6 border-b border-border bg-background/30">
        <h2 className="text-3xl font-display font-bold uppercase tracking-tight text-foreground flex items-center gap-3">
          {icon && <span className="text-accent-green">{icon}</span>}
          {title}
        </h2>
        <span className="text-xs font-bold uppercase tracking-widest text-muted">
          {quests.length} {quests.length === 1 ? "Quest" : "Quests"}
        </span>
      </div>

      {quests.length > 0 ? (
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} onClaim={onClaim} />
          ))}
        </div>
      ) : (
        <div className="p-8">
          <EmptyState
            icon={<Target className="w-16 h-16 text-muted" />}
            title={`No ${title.toLowerCase()}`}
            description="Check back later for new challenges!"
          />
        </div>
      )}
    </Card>
  );
}

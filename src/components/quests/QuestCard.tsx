import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Quest } from "@/lib/types";
import { CheckCircle, Target, Zap } from "lucide-react";
import { QuestIconMap } from "@/lib/constants/quest-icons";
import { useState } from "react";

export interface QuestCardProps {
  quest: Quest;
  className?: string;
  onClaim?: (id: string) => void;
}

/**
 * Displays a single quest with progress/completion state.
 * Styled with Modern Athletic HUD aesthetic.
 */
export function QuestCard({ quest, className = "", onClaim }: QuestCardProps) {
  const Icon = QuestIconMap[quest.icon] || Target;

  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCompleted = quest.completed;
  const isClaimed = quest.claimed;

  return (
    <Card
      className={`p-0 overflow-hidden flex flex-col transition-all duration-200 ${
        isClaimed
          ? "opacity-50 border-border/30"
          : isCompleted
            ? "border-accent-green/40 shadow-[0_0_16px_-4px_rgba(var(--accent-green-rgb,132,204,22),0.25)]"
            : "hover:border-border/80"
      } ${className}`}
    >
      {/* Status bar at top */}
      <div
        className={`h-1 w-full ${isClaimed ? "bg-border/30" : isCompleted ? "bg-accent-green" : "bg-border/40"}`}
      />

      <div className="p-5 flex flex-col gap-4 flex-1">
        {/* Header row: icon + title + XP badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`p-2 rounded-lg border ${isCompleted && !isClaimed ? "bg-accent-green/10 border-accent-green/30 text-accent-green" : "bg-background border-border text-muted"}`}
            >
              <Icon size={20} />
            </div>
            <div>
              <h4
                className={`font-display font-bold text-lg uppercase tracking-tight leading-tight ${isClaimed ? "line-through text-muted" : "text-foreground"}`}
              >
                {quest.title}
              </h4>
              <p className="text-xs text-muted mt-1 leading-snug">
                {quest.description}
              </p>
            </div>
          </div>

          <div className="shrink-0 inline-flex items-center gap-1 bg-accent-green/10 border border-accent-green/20 px-2.5 py-1">
            <Zap size={10} className="text-accent-green" />
            <span className="font-display font-bold text-sm text-accent-green leading-none">
              +{quest.xpReward}
            </span>
          </div>
        </div>

        {/* Footer: progress or claim CTA */}
        <div className="mt-auto">
          {isCompleted ? (
            isClaimed ? (
              <div className="flex items-center gap-2 text-accent-green">
                <CheckCircle size={14} />
                <span className="text-xs font-bold uppercase tracking-widest">
                  Claimed
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  onClick={async () => {
                    setError(null);
                    setIsClaiming(true);
                    try {
                      await onClaim?.(quest.id);
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Failed to claim quest",
                      );
                    } finally {
                      setIsClaiming(false);
                    }
                  }}
                  disabled={isClaiming}
                  className={`w-full py-2.5 text-xs font-bold uppercase tracking-widest text-black active-press disabled:cursor-not-allowed disabled:opacity-50 ${
                    error ? "bg-accent-red" : "bg-accent-green"
                  }`}
                >
                  {isClaiming
                    ? "Claiming..."
                    : error
                      ? "Error — Retry"
                      : `Claim ${quest.xpReward} XP`}
                </button>
                {error && (
                  <span className="text-xs text-accent-red text-center">
                    {error}
                  </span>
                )}
              </div>
            )
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  Progress
                </span>
                <span className="font-display font-bold text-xl tracking-tight text-foreground leading-none">
                  {quest.progress}{" "}
                  <span className="text-muted text-base">/ {quest.target}</span>
                </span>
              </div>
              <ProgressBar
                value={quest.progress}
                max={quest.target}
                colorClass="bg-accent-green"
              />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

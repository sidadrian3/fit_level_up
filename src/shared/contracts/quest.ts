export type QuestCategory = "daily" | "weekly" | "special";

export interface Quest {
    id: string;
    title: string;
    description: string;
    category: QuestCategory;
    xpReward: number;
    progress: number;
    target: number;
    completed: boolean;
    claimed: boolean;
    icon: string;
}

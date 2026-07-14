"use client";
import { getQuests, claimQuest } from "@/lib/data/api-client";
import { PageHeader } from "@/components/layout/PageHeader";
import { QuestSection } from "@/components/quests/QuestSection";
import { Calendar, Sun, Target } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";


export default function QuestsPage() {

    const queryClient = useQueryClient();

    const { data: quests = [], isLoading, isError } =
        useQuery({
            queryKey: ["quests"],
            queryFn: getQuests,

        });

    const claimMutation = useMutation({
        mutationFn: claimQuest,
        onSuccess: async () => {
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ["quests"] }),
                queryClient.invalidateQueries({ queryKey: ["user"] })
            ]);
        },
    });


    // Group quests
    const dailyQuests = quests.filter(q => q.category === "daily");
    const weeklyQuests = quests.filter(q => q.category === "weekly");
    const specialQuests = quests.filter(q => q.category === "special");



    return (
        <div className="space-y-10 pb-12">
            <PageHeader
                title="Quests"
                subtitle="Complete challenges to earn XP and level up faster."
            />

            <QuestSection
                title="Daily Quests"
                quests={dailyQuests}
                icon={<Sun size={20} />}
                onClaim={(id) => claimMutation.mutateAsync(id)}
            />

            <QuestSection
                title="Weekly Quests"
                quests={weeklyQuests}
                icon={<Calendar size={20} />}
                onClaim={(id) => claimMutation.mutateAsync(id)}
            />

            <QuestSection
                title="Special Quests"
                quests={specialQuests}
                icon={<Target size={20} />}
                onClaim={(id) => claimMutation.mutateAsync(id)}
            />
        </div>
    );
}

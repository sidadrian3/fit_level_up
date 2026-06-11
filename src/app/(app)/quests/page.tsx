"use client";
import {useEffect, useState} from "react";
import {Quest} from "@/lib/types";
import {getQuests, claimQuest} from "@/lib/data/repositories";
import { PageHeader } from "@/components/layout/PageHeader";
import { QuestSection } from "@/components/quests/QuestSection";
import { Calendar, Sun, Target } from "lucide-react";


export default function QuestsPage() {

    const [quests, setQuests] = useState<Quest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Group quests
    const dailyQuests = quests.filter(q => q.category === "daily");
    const weeklyQuests = quests.filter(q => q.category === "weekly");
    const specialQuests = quests.filter(q => q.category === "special");

    async function loadQuests() {
        try {
                    setError(null);
                setIsLoading(true);
                const data = await getQuests();
                setQuests([...data]);
            } catch {
                setError("Could not load quests");
            } finally {
                setIsLoading(false);
            }
        }

    async function handleClaim(id: string) {
        try {
            await claimQuest(id);

            const updatedQuests = await getQuests();

            setQuests([...updatedQuests]);
        } catch (err) {
            console.error("Failed to claim quest", err);
        }
}

    useEffect(() => {
        loadQuests();
    }, []);

    



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
                onClaim={handleClaim}
            />
            
            <QuestSection 
                title="Weekly Quests" 
                quests={weeklyQuests} 
                icon={<Calendar size={20} />} 
                onClaim={handleClaim}
            />
            
            <QuestSection 
                title="Special Quests" 
                quests={specialQuests} 
                icon={<Target size={20} />} 
                onClaim={handleClaim}
            />
        </div>
    );
}

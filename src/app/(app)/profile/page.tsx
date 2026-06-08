"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { AchievementGrid } from "@/components/profile/AchievementGrid";
import { PersonalRecords } from "@/components/profile/PersonalRecords";
import { getUser, getAchievements, getDashboardStats } from "@/lib/data/repositories";
import type { Achievement, DashboardStats, User } from "@/lib/types";

export default function ProfilePage() {
    const [user, setUser] = useState<User | null>(null);
    const [achievements, setAchievements] = useState<readonly Achievement[]>([]);
    const [stats, setStats] = useState<DashboardStats | null>(null);

    useEffect(() => {
        async function loadUser() {
            try {
                const data = await getUser();
                setUser(data);
            } catch (err) {
                console.error("Failed to load user for profile", err);
            }
        }


        async function loadAchievements() {
            try {
                const data = await getAchievements();
                setAchievements(data);
            } catch (err) {
                console.error("Failed to load achievements for profile", err);
            }
        }

        async function loadStats() {
            try {
                const data = await getDashboardStats();
                setStats(data)
            } catch (err) {
                console.error("Failed to load achievements", err)

            }
        }

        loadUser();
        loadAchievements();
        loadStats();

        const handleUserUpdate = () => {
            loadUser(); loadAchievements(); loadStats();
        };
        window.addEventListener("user-updated", handleUserUpdate);
        return () => window.removeEventListener("user-updated", handleUserUpdate);

    }, []);



    if (!user || !stats) {
        return (
            <div className="space-y-6 pb-12 animate-pulse">
                <div className="h-20 bg-card rounded-xl w-full"></div>
                <div className="h-64 bg-card rounded-xl w-full"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-12">
            <PageHeader
                title="Profile 👤"
                subtitle="View your stats and achievements."
            />

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-1 space-y-6">
                    <ProfileHeader user={user} stats={stats} />
                    <PersonalRecords />
                </div>

                <div className="xl:col-span-2">
                    <AchievementGrid achievements={achievements} />
                </div>
            </div>
        </div>
    );
}

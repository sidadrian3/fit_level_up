import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCard } from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Dumbbell } from "lucide-react";
import { mockAchievements } from "@/lib/mock-data";

export default function ComponentTestPage() {
    return (
        <div className="space-y-8 pb-20">
            <h1 className="text-3xl font-bold">Component Testing Ground</h1>
            
            <section className="space-y-4">
                <h2 className="text-xl font-bold border-b border-border pb-2">1. Card</h2>
                <Card>This is a standard card with children.</Card>
            </section>
            
            <section className="space-y-4">
                <h2 className="text-xl font-bold border-b border-border pb-2">2. ProgressBar</h2>
                <ProgressBar value={40} max={100} />
                <ProgressBar value={80} max={100} colorClass="bg-accent-blue" />
            </section>
            
            <section className="space-y-4">
                <h2 className="text-xl font-bold border-b border-border pb-2">3. StatCard</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <StatCard 
                        icon={<Dumbbell size={20} className="text-accent-green" />}
                        value="87"
                        label="Total Workouts"
                        trend={{ value: 12, label: "from last week", isPositive: true }}
                    />
                </div>
            </section>
            
            <section className="space-y-4">
                <h2 className="text-xl font-bold border-b border-border pb-2">4. Button</h2>
                <div className="flex gap-4">
                    <Button variant="primary">Primary</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button disabled>Disabled</Button>
                </div>
            </section>
            
            <section className="space-y-4">
                <h2 className="text-xl font-bold border-b border-border pb-2">5. Badge</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {mockAchievements.slice(0, 4).map(ach => (
                        <Badge key={ach.id} achievement={ach} />
                    ))}
                </div>
            </section>
            
            <section className="space-y-4">
                <h2 className="text-xl font-bold border-b border-border pb-2">6. EmptyState</h2>
                <EmptyState 
                    icon="📭"
                    title="No workouts yet"
                    description="You haven't logged any workouts this week. Ready to start crushing it?"
                    action={<Button>Log Workout</Button>}
                />
            </section>
        </div>
    );
}

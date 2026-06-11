import React from "react";
import { Card } from "@/components/ui/Card";
import { Trophy } from "lucide-react";

export interface PersonalRecordsProps {
    className?: string;
}

// Hardcoded records for the prototype
const records = [
    { label: "Bench Press", value: "100 kg", type: "strength" },
    { label: "Squat", value: "140 kg", type: "strength" },
    { label: "Deadlift", value: "180 kg", type: "strength" },
    { label: "5K Run", value: "24:30", type: "cardio" },
    { label: "10K Run", value: "52:15", type: "cardio" },
    { label: "Longest Plank", value: "3:45", type: "endurance" },
];

/**
 * Displays personal bests and records.
 */
export function PersonalRecords({ className = "" }: PersonalRecordsProps) {
    return (
        <Card className={`flex flex-col gap-6 ${className}`}>
            <div className="flex items-center gap-2">
                <Trophy className="text-accent-orange" size={24} />
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Personal Records</h2>
            </div>

            <div className="space-y-3">
                {records.map((record, idx) => (
                    <div 
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg border border-border bg-background hover:border-accent-orange/30 transition-all duration-200"
                    >
                        <span className="text-sm font-medium text-muted">
                            {record.label}
                        </span>
                        <span className="font-semibold text-foreground">
                            {record.value}
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
}

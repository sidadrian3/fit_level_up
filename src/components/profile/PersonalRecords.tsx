"use client";

import { Card } from "@/components/ui/Card";
import { Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getPersonalRecords } from "@/lib/data/api-client";

export interface PersonalRecordsProps {
    className?: string;
}

/**
 * Displays personal bests and records.
 */
export function PersonalRecords({ className = "" }: PersonalRecordsProps) {
    const { data: records = [], isLoading, isError } = useQuery({
        queryKey: ["personal-records"],
        queryFn: getPersonalRecords,
    });

    return (
        <Card className={`flex flex-col gap-6 ${className}`}>
            <div className="flex items-center gap-2">
                <Trophy className="text-accent-orange" size={24} />
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Personal Records</h2>
            </div>

            {isLoading && <p className="text-sm text-muted">Loading records...</p>}
            {isError && <p className="text-sm text-accent-red">Could not load records.</p>}
            
            {!isLoading && !isError && records.length === 0 && (
                <p className="text-sm text-muted">Log your first workout or run to set your records!</p>
            )}

            {!isLoading && !isError && records.length > 0 && (
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
            )}
        </Card>
    );
}

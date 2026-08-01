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
        <Card className={`p-0 overflow-hidden mt-4 ${className}`}>
            <div className="p-6 border-b border-border bg-background/30">
                <h2 className="text-3xl font-display font-bold uppercase tracking-tight text-foreground flex items-center gap-3">
                    <Trophy className="text-accent-orange" size={28} />
                    Personal Records
                </h2>
            </div>

            {isLoading && <p className="p-6 text-sm font-bold uppercase tracking-widest text-muted">Loading records...</p>}
            {isError && <p className="p-6 text-sm font-bold uppercase tracking-widest text-accent-red">Could not load records.</p>}
            
            {!isLoading && !isError && records.length === 0 && (
                <p className="p-6 text-sm font-bold uppercase tracking-widest text-muted">Log your first workout or run to set your records!</p>
            )}

            {!isLoading && !isError && records.length > 0 && (
                <div className="flex flex-col divide-y divide-border">
                    {records.map((record, idx) => (
                        <div
                            key={idx}
                            className="flex items-center justify-between p-6 hover:bg-background/50 transition-colors"
                        >
                            <span className="text-xs font-bold uppercase tracking-widest text-muted">
                                {record.label}
                            </span>
                            <span className="font-display font-bold text-3xl tracking-tight text-foreground leading-none">
                                {record.value}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}

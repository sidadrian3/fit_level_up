import React from "react";
import { Card } from "@/components/ui/Card";

export interface ActivityTrackerProps {
    /** Array of 7 booleans representing Monday to Sunday */
    activeDays?: boolean[];
    className?: string;
}

const DAYS_OF_WEEK = ["M", "T", "W", "T", "F", "S", "S"];

export function ActivityTracker({
    // Default mock data: active on Mon, Tue, Thu, Fri, Sun
    activeDays = [true, true, false, true, true, false, true],
    className = ""
}: ActivityTrackerProps) {
    const activeCount = activeDays.filter(Boolean).length;

    return (
        <Card className={`flex flex-col gap-4 ${className}`}>
            <div>
                <h3 className="text-lg font-semibold text-foreground">Weekly Activity</h3>
                <p className="text-sm text-muted">You&apos;ve been active {activeCount} days this week!</p>
            </div>

            {/* The tracker grid */}
            <div className="flex justify-between items-center mt-2">
                {DAYS_OF_WEEK.map((day, index) => {
                    const isActive = activeDays[index];
                    return (
                        <div key={index} className="flex flex-col items-center gap-2">
                            {/* The circle indicator */}
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center transition-default ${isActive
                                    ? "bg-accent-green text-background shadow-[0_0_10px_rgba(34,197,94,0.3)]"
                                    : "bg-transparent border-2 border-border text-muted"
                                    }`}
                                aria-label={`${day} ${isActive ? 'Active' : 'Rest'}`}
                            >
                                {/* Inner dot for active days */}
                                {isActive && <span className="w-2 h-2 rounded-full bg-background" />}
                            </div>
                            {/* The day label */}
                            <span className="text-xs font-semibold text-muted">{day}</span>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}

import React from "react";

export interface ProgressBarProps {
    value: number;
    max: number;
    colorClass?: string;
    className?: string;
}

export function ProgressBar({
    value,
    max,
    colorClass = "bg-accent-green",
    className = "",
}: ProgressBarProps) {
    // Clamp between 0 and 100 to prevent layout breakage
    const percentage = max > 0
        ? Math.min(100, Math.max(0, (value / max) * 100))
        : 0;

    return (
        <div
            className={`w-full h-2 bg-border rounded-full overflow-hidden ${className}`}
            role="progressbar"
            aria-valuenow={value}
            aria-valuemin={0}
            aria-valuemax={max}
        >
            <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${colorClass}`}
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}

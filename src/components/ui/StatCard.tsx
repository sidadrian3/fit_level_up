import React from "react";
import { Card } from "./Card";

export interface StatCardProps {
    icon: React.ReactNode;
    value: React.ReactNode;
    label: string;
    iconBgColor?: string;
    trend?: {
        value: number;
        label: string;
        isPositive: boolean;
    };
    className?: string;
}

export function StatCard({
    icon,
    value,
    label,
    iconBgColor = "bg-accent-green/10",
    trend,
    className = "",
}: StatCardProps) {
    return (
        <Card className={`flex flex-col gap-4 ${className}`}>
            <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBgColor}`}>
                    {icon}
                </div>
                {trend && (
                    <div className={`text-sm font-medium flex items-center gap-1 px-2 py-1 rounded-full bg-card-hover ${trend.isPositive ? 'text-accent-green' : 'text-accent-red'}`}>
                        {trend.isPositive ? '↑' : '↓'} {trend.value}%
                    </div>
                )}
            </div>
            <div>
                <div className="text-4xl font-bold tracking-tight text-foreground mt-2">{value}</div>
                <div className="text-sm text-muted mt-1">{label}</div>
            </div>
        </Card>
    );
}

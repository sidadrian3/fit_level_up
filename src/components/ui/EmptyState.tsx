import React from "react";

export interface EmptyStateProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    className?: string;
    action?: React.ReactNode; // Flexible slot for CTA buttons
}

export function EmptyState({ 
    icon, 
    title, 
    description, 
    className = "",
    action
}: EmptyStateProps) {
    return (
        <div className={`flex flex-col items-center justify-center text-center py-12 px-4 border border-dashed border-border rounded-xl bg-card/50 ${className}`}>
            <div className="mb-3 flex justify-center text-muted">
                {typeof icon === "string" ? <span className="text-4xl">{icon}</span> : icon}
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted max-w-sm mb-6">{description}</p>
            {action && <div>{action}</div>}
        </div>
    );
}

import React from "react";

export interface CardProps extends
    React.HTMLAttributes<HTMLDivElement> {
    children: React.ReactNode;
    as?: "div" | "article" | "section";
}

export function Card({
    children,
    className = "",
    as: Component = "div",
    ...props
}: CardProps) {
    return (
        <Component
            className={`bg-card border border-border rounded-xl p-6 shadow-sm ${className}`}
            {...props}
        >
            {children}
        </Component>
    );
}
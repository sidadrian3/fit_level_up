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
            className={`glass-panel rounded-2xl p-8 transition-all duration-300 hover-lift ${className}`}
            {...props}
        >
            {children}
        </Component>
    );
}
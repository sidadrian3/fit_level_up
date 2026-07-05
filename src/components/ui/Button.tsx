import React from "react";

export type ButtonVariant = "primary" | "secondary" | "outline";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
}

// Map variants to specific Tailwind class strings to avoid nasty nested ternaries
const variantStyles: Record<ButtonVariant, string> = {
    primary: "bg-accent-green text-background hover:opacity-90",
    secondary: "bg-card-hover text-foreground hover:bg-border",
    outline: "border border-border text-foreground hover:bg-card-hover",
};

export function Button({
    children,
    variant = "primary",
    className = "",
    ...props
}: ButtonProps) {
    // Base styles all buttons share, plus focus/disabled states
    const baseStyles = "px-6 py-3 font-medium rounded-xl transition-default text-base inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent-green/50 disabled:opacity-50 disabled:cursor-not-allowed hover-lift";
    
    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

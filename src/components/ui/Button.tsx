import React from "react";

export type ButtonVariant = "primary" | "secondary" | "outline";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
}

const variantStyles: Record<ButtonVariant, string> = {
    primary: "bg-accent-green text-black hover:bg-accent-green/90",
    secondary: "bg-card text-foreground border border-white/5 hover:border-white/20",
    outline: "border border-border text-foreground hover:bg-card hover:border-accent-green/50",
};

export function Button({
    children,
    variant = "primary",
    className = "",
    ...props
}: ButtonProps) {
    const baseStyles = "px-6 py-3 font-bold rounded-xl transition-default text-base inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent-green/50 disabled:opacity-50 disabled:cursor-not-allowed active-press uppercase tracking-wide";
    
    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}

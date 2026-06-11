interface PageHeaderProps {
    title: string;
    subtitle?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
    actions?: Array<{
        label: string;
        onClick: () => void;
        variant?: "primary" | "secondary";
    }>;
}

export function PageHeader({ title, subtitle, action, actions }: PageHeaderProps) {
    const allActions = actions || (action ? [{ ...action, variant: "primary" as const }] : []);

    return (
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
                {subtitle && (
                    <p className="text-muted mt-1">{subtitle}</p>
                )}
            </div>
            {allActions.length > 0 && (
                <div className="flex items-center space-x-3">
                    {allActions.map((act, idx) => (
                        <button
                            key={idx}
                            onClick={act.onClick}
                            className={`px-5 py-2.5 font-semibold rounded-lg hover:opacity-90 transition-default text-sm ${act.variant === "secondary"
                                ? "bg-card border border-border text-foreground hover:bg-white/5"
                                : "bg-accent-green text-background"
                                }`}
                        >
                            {act.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

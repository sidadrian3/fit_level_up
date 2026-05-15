interface PageHeaderProps {
    title: string;
    subtitle?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
    return (
        <div className="flex items-center justify-between mb-8">
            <div>
                <h1 className="text-3xl font-bold text-foreground">{title}</h1>
                {subtitle && (
                    <p className="text-muted mt-1">{subtitle}</p>
                )}
            </div>
            {action && (
                <button
                    onClick={action.onClick}
                    className="px-5 py-2.5 bg-accent-green text-background font-semibold rounded-lg hover:opacity-90 transition-default text-sm"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}

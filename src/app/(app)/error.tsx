"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AlertTriangle } from "lucide-react";

export default function AppError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service if you add one later (e.g., Sentry)
        console.error("App boundary caught an error:", error);
    }, [error]);

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="max-w-md w-full flex flex-col items-center text-center p-8 border-accent-red/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]">
                <div className="w-16 h-16 rounded-full bg-accent-red/10 flex items-center justify-center mb-6">
                    <AlertTriangle className="w-8 h-8 text-accent-red" />
                </div>

                <h2 className="text-xl font-bold text-foreground mb-2">Something went wrong!</h2>
                <p className="text-muted text-sm mb-8">
                    We hit a snag trying to load this page. Don&apos;t worry, your data is safe.
                </p>

                <div className="flex gap-4 w-full">
                    <Button
                        onClick={() => reset()}
                        className="flex-1 bg-accent-red text-background hover:bg-accent-red/90"
                    >
                        Try again
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={() => window.location.href = '/dashboard'}
                        className="flex-1"
                    >
                        Go home
                    </Button>
                </div>
            </Card>
        </div>
    );
}

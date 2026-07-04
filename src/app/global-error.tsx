"use client";

import { Inter } from "next/font/google";
import { AlertTriangle } from "lucide-react";
import "./globals.css"; // Ensure global styles are loaded

const inter = Inter({ subsets: ["latin"] });

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.className} bg-background text-foreground antialiased min-h-screen flex items-center justify-center p-4`}>
                <div className="max-w-md w-full bg-card rounded-2xl border border-accent-red/20 p-8 text-center shadow-xl">
                    <div className="mx-auto w-16 h-16 rounded-full bg-accent-red/10 flex items-center justify-center mb-6">
                        <AlertTriangle className="w-8 h-8 text-accent-red" />
                    </div>

                    <h1 className="text-2xl font-bold mb-3">Critical System Error</h1>
                    <p className="text-muted text-sm mb-8">
                        The application encountered an unexpected fatal error and could not recover.
                    </p>

                    <button
                        onClick={() => reset()}
                        className="w-full bg-accent-red text-background font-semibold rounded-lg px-4 py-3 hover:scale-[1.02] transition-transform"
                    >
                        Attempt Recovery
                    </button>

                    <button
                        onClick={() => window.location.reload()}
                        className="w-full mt-3 text-muted text-sm hover:text-foreground transition-colors"
                    >
                        Force Refresh
                    </button>
                </div>
            </body>
        </html>
    );
}

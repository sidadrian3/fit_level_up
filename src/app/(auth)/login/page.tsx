"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Zap } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        const { data, error: signInError } = await authClient.signIn.email({
            email,
            password,
        });

        if (signInError) {
            setError(signInError.message || "Failed to sign in. Please check your credentials.");
            setIsLoading(false);
        } else {
            router.push("/dashboard");
        }
    };

    return (
        <Card className="hover:scale-100 hover:shadow-sm">
            <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-full bg-accent-green/10 flex items-center justify-center border border-accent-green/20 mb-4 shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                    <Zap className="w-8 h-8 text-accent-green" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Welcome Back</h1>
                <p className="text-muted text-sm mt-2">Log in to continue your journey</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                        {error}
                    </div>
                )}
                
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="email">
                        Email
                    </label>
                    <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-green/50 focus:border-accent-green transition-all"
                        placeholder="hero@example.com"
                    />
                </div>
                
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="password">
                        Password
                    </label>
                    <input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-green/50 focus:border-accent-green transition-all"
                        placeholder="••••••••"
                    />
                </div>

                <Button 
                    type="submit" 
                    className="w-full py-4 mt-4 bg-accent-green text-background hover:scale-[1.02] transition-transform"
                    disabled={isLoading}
                >
                    {isLoading ? "Logging in..." : "Log In"}
                </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted">
                Don't have an account?{" "}
                <Link href="/signup" className="text-accent-green hover:underline font-medium">
                    Sign up
                </Link>
            </div>
        </Card>
    );
}

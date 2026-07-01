"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Rocket } from "lucide-react";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        const { data, error: signUpError } = await authClient.signUp.email({
            email,
            password,
            name,
            image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
        });

        if (signUpError) {
            setError(signUpError.message || "Failed to sign up. Please try again.");
            setIsLoading(false);
        } else {
            router.push("/dashboard");
        }
    };

    return (
        <Card className="hover:scale-100 hover:shadow-sm">
            <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-full bg-accent-blue/10 flex items-center justify-center border border-accent-blue/20 mb-4 shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                    <Rocket className="w-8 h-8 text-accent-blue" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create Account</h1>
                <p className="text-muted text-sm mt-2">Start your fitness journey today</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                        {error}
                    </div>
                )}
                
                <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor="name">
                        Name
                    </label>
                    <input
                        id="name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue transition-all"
                        placeholder="Fitness Hero"
                    />
                </div>

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
                        className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue transition-all"
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
                        className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue transition-all"
                        placeholder="••••••••"
                        minLength={8}
                    />
                </div>

                <Button 
                    type="submit" 
                    className="w-full py-4 mt-4 bg-accent-blue text-background hover:scale-[1.02] transition-transform"
                    disabled={isLoading}
                >
                    {isLoading ? "Creating account..." : "Sign Up"}
                </Button>
            </form>

            <div className="mt-6 text-center text-sm text-muted">
                Already have an account?{" "}
                <Link href="/login" className="text-accent-blue hover:underline font-medium">
                    Log in
                </Link>
            </div>
        </Card>
    );
}

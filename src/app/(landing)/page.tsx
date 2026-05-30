import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
    return (
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background min-h-[100vh]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent-green/20 via-background to-background -z-10" />
            
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out flex flex-col items-center max-w-3xl mx-auto space-y-8">
                <div className="w-24 h-24 rounded-full bg-accent-green/10 flex items-center justify-center border border-accent-green/20 mb-4 shadow-[0_0_50px_rgba(34,197,94,0.3)]">
                    <span className="text-5xl">⚡</span>
                </div>
                
                <h1 className="text-5xl md:text-7xl font-extrabold text-foreground tracking-tight">
                    Level Up Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-green to-accent-blue">Fitness</span>
                </h1>
                
                <p className="text-xl md:text-2xl text-muted max-w-2xl">
                    Gamify your workouts, earn XP, complete daily quests, and unlock epic achievements. Your fitness journey is now an RPG.
                </p>
                
                <div className="pt-8">
                    <Link href="/dashboard">
                        <Button className="px-8 py-4 text-lg bg-accent-green text-background hover:scale-105 hover:shadow-lg hover:shadow-accent-green/20 transition-all duration-300">
                            Get Started Now
                        </Button>
                    </Link>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 w-full opacity-80">
                    <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border">
                        <span className="text-3xl text-accent-orange">🔥</span>
                        <h3 className="font-bold text-lg">Build Streaks</h3>
                        <p className="text-sm text-muted">Stay consistent and watch your streak multiplier grow.</p>
                    </div>
                    <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border">
                        <span className="text-3xl text-accent-purple">🏆</span>
                        <h3 className="font-bold text-lg">Unlock Badges</h3>
                        <p className="text-sm text-muted">Earn rare achievements for pushing your limits.</p>
                    </div>
                    <div className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-card border border-border">
                        <span className="text-3xl text-accent-blue">📈</span>
                        <h3 className="font-bold text-lg">Track Progress</h3>
                        <p className="text-sm text-muted">Watch your stats improve with detailed analytics.</p>
                    </div>
                </div>
            </div>
        </main>
    );
}

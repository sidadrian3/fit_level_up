import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Zap, Flame, Trophy, LineChart } from "lucide-react";

export default function LandingPage() {
    return (
        <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center bg-black min-h-[100vh] relative overflow-hidden">
            {/* Subtle glow instead of loud radial gradient for OLED contrast */}
            <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-accent-green/10 rounded-full blur-[150px] pointer-events-none -z-10" />
            
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out flex flex-col items-center max-w-4xl mx-auto space-y-8 pt-20 pb-16">
                
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/5 bg-white/5 text-sm font-medium text-muted tracking-wide mb-2">
                    <div className="w-2 h-2 rounded-full bg-accent-green" />
                    YOUR FITNESS JOURNEY, REIMAGINED
                </div>

                <h1 className="text-6xl md:text-8xl font-bold text-foreground tracking-tight leading-[1.1]">
                    Level Up <br className="hidden md:block"/>
                    Your <span className="text-accent-green">Fitness</span>
                </h1>
                
                <p className="text-xl md:text-2xl text-muted max-w-3xl leading-relaxed font-normal mt-4 mb-8">
                    Gamify your workouts, earn XP, complete daily quests, and unlock epic achievements. Your fitness journey is now an RPG.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                    <Link href="/signup">
                        <Button className="px-8 py-6 text-lg bg-accent-green text-black hover:bg-accent-green/90 transition-all duration-300 rounded-full font-semibold flex items-center gap-2">
                            Get Started Now <span className="text-xl leading-none">→</span>
                        </Button>
                    </Link>
                    <Link href="#how-it-works">
                        <Button variant="outline" className="px-8 py-6 text-lg bg-transparent border-white/10 text-foreground hover:bg-white/5 transition-all duration-300 rounded-full font-semibold">
                            See How It Works
                        </Button>
                    </Link>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-24 w-full">
                    <div className="flex flex-col items-center text-center gap-4 p-8 rounded-3xl glass-panel hover-lift">
                        <div className="w-16 h-16 rounded-2xl bg-accent-orange/10 flex items-center justify-center mb-2">
                            <Flame className="w-8 h-8 text-accent-orange" />
                        </div>
                        <h3 className="font-bold text-2xl tracking-tight">Build Streaks</h3>
                        <p className="text-base text-muted/80 leading-relaxed">Stay consistent and watch your streak multiplier grow effortlessly.</p>
                    </div>
                    
                    <div className="flex flex-col items-center text-center gap-4 p-8 rounded-3xl glass-panel hover-lift">
                        <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center mb-2">
                            <Trophy className="w-8 h-8 text-accent-purple" />
                        </div>
                        <h3 className="font-bold text-2xl tracking-tight">Unlock Badges</h3>
                        <p className="text-base text-muted/80 leading-relaxed">Earn rare achievements for pushing your limits and reaching milestones.</p>
                    </div>
                    
                    <div className="flex flex-col items-center text-center gap-4 p-8 rounded-3xl glass-panel hover-lift">
                        <div className="w-16 h-16 rounded-2xl bg-accent-blue/10 flex items-center justify-center mb-2">
                            <LineChart className="w-8 h-8 text-accent-blue" />
                        </div>
                        <h3 className="font-bold text-2xl tracking-tight">Track Progress</h3>
                        <p className="text-base text-muted/80 leading-relaxed">Watch your stats improve over time with highly detailed analytics.</p>
                    </div>
                </div>
            </div>
        </main>
    );
}

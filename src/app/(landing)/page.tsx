import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Flame, Trophy, LineChart } from "lucide-react";

export default function LandingPage() {
    return (
        <main className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 text-center bg-black min-h-screen relative overflow-hidden">
            {/* Extremely subtle glow for OLED contrast */}
            <div className="absolute top-[-10%] left-[-10%] w-200 h-200 bg-accent-green/5 rounded-full blur-[150px] pointer-events-none -z-10" />
            
            <div className="animate-in fade-in slide-in-from-bottom-8 duration-500 ease-out flex flex-col items-center max-w-4xl mx-auto space-y-6 pt-20 pb-16">
                
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent-green/20 bg-accent-green/10 text-xs font-bold text-accent-green uppercase tracking-widest mb-4">
                    YOUR FITNESS JOURNEY, REIMAGINED
                </div>

                <h1 className="text-7xl md:text-9xl font-display font-bold text-foreground tracking-tight uppercase leading-[0.9]">
                    Level Up <br className="hidden md:block"/>
                    Your <span className="text-accent-green">Fitness</span>
                </h1>
                
                <p className="text-xl md:text-2xl text-muted max-w-2xl leading-relaxed font-medium mt-6 mb-8">
                    Gamify your workouts. Earn XP. Complete daily quests. 
                    <br className="hidden md:block"/> Your fitness journey is now an RPG.
                </p>
                
                <div className="flex flex-col sm:flex-row items-center gap-4 pt-6">
                    <Link href="/signup">
                        <Button className="px-10 py-6 text-lg rounded-full gap-2">
                            GET STARTED NOW <span className="text-xl leading-none">→</span>
                        </Button>
                    </Link>
                    <Link href="#how-it-works">
                        <Button variant="outline" className="px-10 py-6 text-lg rounded-full">
                            SEE HOW IT WORKS
                        </Button>
                    </Link>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-24 w-full">
                    <div className="flex flex-col items-center text-center gap-4 p-8 rounded-2xl glass-panel active-press hover:border-accent-orange/50 transition-default">
                        <div className="w-14 h-14 rounded-xl bg-accent-orange/10 flex items-center justify-center mb-2">
                            <Flame className="w-7 h-7 text-accent-orange" />
                        </div>
                        <h3 className="font-display font-bold uppercase text-3xl tracking-tight">Build Streaks</h3>
                        <p className="text-sm text-muted leading-relaxed">Stay consistent and watch your streak multiplier grow effortlessly.</p>
                    </div>
                    
                    <div className="flex flex-col items-center text-center gap-4 p-8 rounded-2xl glass-panel active-press hover:border-accent-purple/50 transition-default">
                        <div className="w-14 h-14 rounded-xl bg-accent-purple/10 flex items-center justify-center mb-2">
                            <Trophy className="w-7 h-7 text-accent-purple" />
                        </div>
                        <h3 className="font-display font-bold uppercase text-3xl tracking-tight">Unlock Badges</h3>
                        <p className="text-sm text-muted leading-relaxed">Earn rare achievements for pushing your limits and reaching milestones.</p>
                    </div>
                    
                    <div className="flex flex-col items-center text-center gap-4 p-8 rounded-2xl glass-panel active-press hover:border-accent-blue/50 transition-default">
                        <div className="w-14 h-14 rounded-xl bg-accent-blue/10 flex items-center justify-center mb-2">
                            <LineChart className="w-7 h-7 text-accent-blue" />
                        </div>
                        <h3 className="font-display font-bold uppercase text-3xl tracking-tight">Track Progress</h3>
                        <p className="text-sm text-muted leading-relaxed">Watch your stats improve over time with highly detailed analytics.</p>
                    </div>
                </div>
            </div>
        </main>
    );
}

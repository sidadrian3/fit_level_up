import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";

export function LevelUpToast({ level, onClose }: { level: number; onClose: () => void }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300); // Wait for transition
        }, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 p-4 bg-card border-2 border-accent-green rounded-xl shadow-lg transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="w-12 h-12 rounded-full bg-accent-green/20 flex items-center justify-center animate-bounce">
                <Trophy className="text-accent-green" size={24} />
            </div>
            <div>
                <h3 className="font-bold text-foreground text-lg">Level Up!</h3>
                <p className="text-sm text-muted">You are now Level {level}!</p>
            </div>
            <button onClick={() => setVisible(false)} className="absolute top-2 right-2 text-muted hover:text-foreground">
                ×
            </button>
        </div>
    );
}

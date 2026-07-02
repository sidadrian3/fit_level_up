import { useEffect, useState } from "react";
import type { Achievement } from "@/lib/types";
import { AchievementIconMap } from "@/lib/constants/achievement-icons";
import { Trophy } from "lucide-react";

export function AchievementToast({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            setTimeout(onClose, 300); // Wait for transition
        }, 5000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-24 right-4 z-50 flex items-center gap-4 p-4 bg-card border-2 border-accent-purple rounded-xl shadow-lg transition-all duration-300 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="w-12 h-12 rounded-full bg-accent-purple/20 flex items-center justify-center text-accent-purple animate-bounce">
                {(() => {
                    const Icon = AchievementIconMap[achievement.icon] || Trophy;
                    return <Icon className="w-6 h-6" />;
                })()}
            </div>
            <div>
                <p className="text-xs font-semibold text-accent-purple uppercase tracking-wider">Achievement Unlocked!</p>
                <h3 className="font-semibold text-foreground">{achievement.title}</h3>
            </div>
            <button onClick={() => setVisible(false)} className="absolute top-2 right-2 text-muted hover:text-foreground">
                ×
            </button>
        </div>
    );
}

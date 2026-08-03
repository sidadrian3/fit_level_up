import { getRecentlyActiveUsers } from "@/lib/data/user-db";
import { evaluateAchievements } from "@/lib/services/achievements/evaluate-achievements";

/**
 * Periodically invoked by Vercel Cron.
 * Re-evaluates achievements for users who have been active in the last 24 hours
 * to ensure that achievements missed due to dropped background tasks are recovered.
 */
export async function sweepLockedAchievements(): Promise<{ processed: number; errors: number }> {
    // 1. Fetch users active in the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const activeUsers = await getRecentlyActiveUsers(yesterday);
    
    let processed = 0;
    let errors = 0;

    // 2. Safely re-evaluate for each active user
    // Since evaluateAchievements is idempotent, this is 100% safe
    for (const user of activeUsers) {
        try {
            await evaluateAchievements(user.id);
            processed++;
        } catch (error) {
            console.error(`[Background Sweep] Failed to evaluate achievements for user ${user.id}:`, error);
            errors++;
        }
    }

    console.log(`[Background Sweep] Finished sweeping ${processed} users. Errors: ${errors}`);
    return { processed, errors };
}

import { getRecentlyActiveUsers } from "@/lib/data/user-db";
import { evaluateAchievements } from "@/lib/services/achievements/evaluate-achievements";

/**
 * Periodically invoked by Vercel Cron.
 * Re-evaluates achievements for users who have been active in the last 72 hours
 * to ensure that achievements missed due to dropped background tasks are recovered.
 */
export async function sweepLockedAchievements(): Promise<{ processed: number; errors: number }> {
    // lastActivityDate stores a local-day midnight, up to 36 h before the activity (UTC-12)
    const since = new Date(Date.now() - 72 * 3_600_000);

    const activeUsers = await getRecentlyActiveUsers(since);
    
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

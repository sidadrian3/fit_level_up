import { getRecentlyActiveUsers } from "@/lib/data/user-db";
import { evaluateAchievements } from "@/lib/services/achievements/evaluate-achievements";

/**
 * Periodically invoked by Vercel Cron.
 * Re-evaluates achievements for users who have been active in the last 72 hours
 * to ensure that achievements missed due to dropped background tasks are recovered.
 */
// lastActivityDate stores a local-day midnight, up to 36 h before the activity (UTC-12), so 24 h would miss users
const ACTIVE_USER_LOOKBACK_MS = 72 * 3_600_000;

export async function sweepLockedAchievements(): Promise<{ processed: number; errors: number }> {
    const since = new Date(Date.now() - ACTIVE_USER_LOOKBACK_MS);

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

import { createDefineRoute } from "@/server/platform/http";
import { getAuthUserId } from "@/lib/auth/auth-helpers";
import { RateLimit } from "@/lib/auth/rate-limit";

// Lib seams keep the route tests' existing auth and limiter mocks effective until the tiers land (2.3).
export const defineRoute = createDefineRoute({
  requireUserId: getAuthUserId,
  limit: (id) => RateLimit.limit(id),
});

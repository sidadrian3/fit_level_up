import type { Run } from "@/lib/types";
import { listRunsPage } from "./run.repository";

export function listRuns(userId: string, page: number, limit: number): Promise<{ data: Run[]; totalCount: number }> {
    return listRunsPage(userId, page, limit);
}

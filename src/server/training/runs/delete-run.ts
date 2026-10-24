import { deleteRunById } from "./run.repository";

export function deleteRun(userId: string, runId: string): Promise<boolean> {
    return deleteRunById(userId, runId);
}

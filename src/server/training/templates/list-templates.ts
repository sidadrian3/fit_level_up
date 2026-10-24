import type { WorkoutTemplate } from "@/lib/types";
import { listTemplatesForUser } from "./template.repository";

export function listTemplates(userId: string): Promise<WorkoutTemplate[]> {
    return listTemplatesForUser(userId);
}

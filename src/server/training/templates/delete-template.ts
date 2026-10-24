import { deleteTemplateById } from "./template.repository";

export function deleteTemplate(userId: string, templateId: string): Promise<boolean> {
    return deleteTemplateById(userId, templateId);
}

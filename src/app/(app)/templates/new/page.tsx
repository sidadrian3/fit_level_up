import { CreateTemplateForm } from "@/components/workouts/CreateTemplateForm";

export default function NewTemplatePage() {
    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-8 animate-in fade-in duration-300">
            <div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                    Create Template
                </h1>
                <p className="text-muted mt-2 text-base md:text-lg max-w-2xl">
                    Build a reusable workout routine. Templates make logging your regular workouts faster and friction-free.
                </p>
            </div>

            <CreateTemplateForm />
        </div>
    );
}

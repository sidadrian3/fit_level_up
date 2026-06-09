import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <main className="flex-1 flex flex-col items-center justify-center p-8 bg-background min-h-[100vh]">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-accent-green/10 via-background to-background -z-10" />
            <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000 ease-out">
                {children}
            </div>
        </main>
    );
}

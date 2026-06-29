export default function ProfileLoading() {
    return (
        <div className="space-y-6 pb-12 animate-pulse">
            <div className="h-20 bg-card rounded-xl w-full"></div>
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-1 space-y-6">
                    <div className="h-64 bg-card rounded-xl w-full"></div>
                </div>
                <div className="xl:col-span-2">
                    <div className="h-96 bg-card rounded-xl w-full"></div>
                </div>
            </div>
        </div>
    );
}

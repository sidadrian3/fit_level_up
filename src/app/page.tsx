import Link from "next/link";

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">⚡ FitLevelUp</h1>
        <p className="text-muted mb-8">Landing page coming soon</p>
        <Link
          href="/dashboard"
          className="px-6 py-3 bg-accent-green text-background font-semibold rounded-lg hover:opacity-90 transition-default"
        >
          Go to Dashboard →
        </Link>
      </div>
    </div>
  );
}

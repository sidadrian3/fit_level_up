import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FitLevelUp — Gamified Fitness Tracker",
  description:
    "Level up your fitness journey with XP, quests, and achievements.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex bg-background text-foreground">
        {/* Sidebar — fixed left navigation */}
        <Sidebar />

        {/* Main content area — offset by sidebar width */}
        <main className="flex-1 ml-64 p-8">{children}</main>
      </body>
    </html>
  );
}

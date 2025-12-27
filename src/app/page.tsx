import Link from "next/link";
import { SetlistDashboard } from "@/components/setlist-dashboard";
import { LogicSection } from "@/components/logic-section";
import { UseCasesSection } from "@/components/use-cases-section";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-start from-background to-black bg-gradient-to-b text-foreground p-4 md:p-8">
      <main className="w-full max-w-5xl flex flex-col items-center gap-12 pt-12 md:pt-20">

        {/* Header */}
        <div className="text-center space-y-4">
          <div className="relative inline-flex items-center justify-center">
            <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 opacity-30 blur-2xl"></div>
            <h1 className="relative text-6xl md:text-8xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
              SETLIST AI
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-lg mx-auto font-light">
            Curate the perfect parabolic energy flow for your next mix.
          </p>
        </div>

        {/* Dashboard Component */}
        <SetlistDashboard />

        {/* Separator */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-12" />

        {/* New Educational Sections */}
        <LogicSection />
        <UseCasesSection />

      </main>

      <footer className="mt-auto py-12 text-center text-sm text-muted-foreground/50">
        Built with Next.js 15 & Gemini 3 Pro
      </footer>
    </div>
  );
}

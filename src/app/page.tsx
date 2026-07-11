import { SetlistDashboard } from "@/components/setlist-dashboard";
import { LogicSection } from "@/components/logic-section";
import { UseCasesSection } from "@/components/use-cases-section";

function HeroCurve() {
  return (
    <svg
      viewBox="0 0 480 120"
      className="w-full h-24 md:h-32"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="curveFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* grid */}
      {[24, 48, 72, 96].map((y) => (
        <line key={y} x1="0" y1={y} x2="480" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      <path
        d="M0,110 C80,108 130,30 240,18 C350,6 400,80 480,104 L480,120 L0,120 Z"
        fill="url(#curveFill)"
      />
      <path
        id="energyPath"
        d="M0,110 C80,108 130,30 240,18 C350,6 400,80 480,104"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="2"
        filter="url(#glow)"
      />
      <circle r="4" fill="var(--accent)">
        <animateMotion dur="6s" repeatCount="indefinite" rotate="0">
          <mpath href="#energyPath" />
        </animateMotion>
      </circle>
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col text-foreground">
      <main className="w-full max-w-5xl mx-auto flex-grow flex flex-col px-5 md:px-8">
        {/* Hero */}
        <section className="pt-24 md:pt-32 pb-10">
          <p className="font-mono text-xs tracking-[0.25em] text-accent mb-6">
            BPM · KEY · ENERGY — MEASURED, NOT GUESSED
          </p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.05] max-w-2xl">
            Engineered setlists,
            <br />
            <span className="text-muted">not shuffles.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted max-w-xl leading-relaxed">
            Paste a Spotify playlist. We analyze the actual audio in your
            browser — tempo, key, energy — then sequence a set that warms up,
            peaks, and lands.
          </p>
          <div className="mt-10 border-y border-border">
            <HeroCurve />
          </div>
        </section>

        {/* Generator + Results */}
        <SetlistDashboard />

        {/* How it works */}
        <LogicSection />

        {/* Who it's for */}
        <UseCasesSection />
      </main>

      <footer className="border-t border-border mt-24">
        <div className="max-w-5xl mx-auto px-5 md:px-8 py-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <span className="font-mono text-xs tracking-widest text-faint">
            SETLIST&nbsp;AI
          </span>
          <span className="font-mono text-[11px] text-faint">
            Audio analysis runs client-side via Essentia WASM. Nothing is uploaded.
          </span>
        </div>
      </footer>
    </div>
  );
}

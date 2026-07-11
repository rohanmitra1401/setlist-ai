"use client";

import { motion } from "framer-motion";

const StepAnalyze = () => (
    <svg viewBox="0 0 120 40" className="w-full h-10" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => {
            const heights = [8, 14, 22, 30, 26, 34, 18, 28, 36, 24, 32, 16, 26, 34, 20, 30, 12, 22, 28, 16, 24, 10, 18, 8];
            const h = heights[i];
            return (
                <rect
                    key={i}
                    x={i * 5}
                    y={(40 - h) / 2}
                    width="2.5"
                    height={h}
                    rx="1"
                    fill={i % 5 === 0 ? "var(--accent)" : "rgba(255,255,255,0.25)"}
                />
            );
        })}
    </svg>
);

const StepKeys = () => (
    <svg viewBox="0 0 120 40" className="w-full h-10" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => {
            const hue = i * 30;
            const active = i === 7 || i === 8 || i === 6;
            return (
                <circle
                    key={i}
                    cx={12 + i * 9}
                    cy="20"
                    r={active ? 4 : 2.5}
                    fill={`hsl(${hue} 85% 65% / ${active ? 0.9 : 0.25})`}
                />
            );
        })}
        <path
            d="M66,20 Q75,8 84,20"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1"
            opacity="0.7"
        />
    </svg>
);

const StepArc = () => (
    <svg viewBox="0 0 120 40" className="w-full h-10" aria-hidden>
        <path
            d="M4,36 C30,34 40,8 60,6 C80,4 95,26 116,34"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.5"
        />
        {[4, 30, 60, 90, 116].map((x, i) => {
            const ys = [36, 22, 6, 20, 34];
            return <circle key={i} cx={x} cy={ys[i]} r="2" fill="var(--accent)" />;
        })}
    </svg>
);

const steps = [
    {
        n: "01",
        title: "Analyze",
        body: "Every track's preview is decoded in your browser. Essentia measures true BPM, key, and energy from the waveform — no stale metadata.",
        visual: StepAnalyze,
    },
    {
        n: "02",
        title: "Match keys",
        body: "Transitions follow the Camelot wheel. Adjacent keys mix clean; clashes are scored out of the sequence.",
        visual: StepKeys,
    },
    {
        n: "03",
        title: "Shape the arc",
        body: "The set builds like a real one: warm-up, climb, peak, cool-down. No random walks through your library.",
        visual: StepArc,
    },
];

export function LogicSection() {
    return (
        <section className="mt-24 border-t border-border pt-14">
            <p className="font-mono text-[11px] tracking-[0.25em] text-faint mb-10">
                HOW IT WORKS
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border border border-border rounded-lg overflow-hidden">
                {steps.map((s, i) => (
                    <motion.div
                        key={s.n}
                        initial={{ opacity: 0, y: 12 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: i * 0.08 }}
                        className="bg-surface p-6 md:p-7"
                    >
                        <div className="mb-6">
                            <s.visual />
                        </div>
                        <div className="flex items-baseline gap-3 mb-2">
                            <span className="font-mono text-[11px] text-accent">{s.n}</span>
                            <h3 className="text-base font-semibold">{s.title}</h3>
                        </div>
                        <p className="text-sm text-muted leading-relaxed">{s.body}</p>
                    </motion.div>
                ))}
            </div>
        </section>
    );
}

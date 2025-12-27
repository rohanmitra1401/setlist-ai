"use client";

import { motion } from "framer-motion";

export function LogicSection() {
    return (
        <section className="w-full max-w-5xl mx-auto py-24 px-4">
            <div className="text-center mb-16 space-y-4">
                <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                    The Science of Flow
                </h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    We don't just shuffle. We engineer the perfect listening experience using professional DJ principles.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Card 1: The Mountain Curve */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 }}
                    className="relative group p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl hover:bg-black/50 transition-colors overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative z-10 space-y-6">
                        <div className="h-48 w-full bg-black/20 rounded-xl border border-white/5 flex items-end justify-center px-8 pb-8 overflow-hidden">
                            {/* Abstract Curve Visualization */}
                            <svg viewBox="0 0 100 50" className="w-full h-full stroke-blue-500 stroke-[3] fill-none drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                <path d="M0,50 C20,50 30,10 50,5 C70,0 80,50 100,50" />
                            </svg>
                            <div className="absolute top-4 right-4 text-xs font-mono text-blue-400">ENERGY_LEVEL: OPTIMAL</div>
                        </div>

                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Parabolic Energy Curve</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                Random shuffle kills the vibe. Our engine builds a "Mountain" structure: starting with a warm-up, climbing to a peak, and gently cooling down.
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Card 2: Harmonic Mixing */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="relative group p-8 rounded-3xl bg-black/40 border border-white/10 backdrop-blur-xl hover:bg-black/50 transition-colors overflow-hidden"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative z-10 space-y-6">
                        <div className="h-48 w-full bg-black/20 rounded-xl border border-white/5 flex items-center justify-center relative overflow-hidden">
                            {/* Abstract Camelot Ring */}
                            <div className="absolute w-32 h-32 rounded-full border-2 border-violet-500/30 flex items-center justify-center">
                                <div className="w-20 h-20 rounded-full border-2 border-violet-500/60 flex items-center justify-center animate-pulse">
                                    <div className="w-8 h-8 rounded-full bg-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.6)]" />
                                </div>
                            </div>
                            <div className="absolute top-4 right-4 text-xs font-mono text-violet-400">HARMONIC_MATCH: TRUE</div>
                        </div>

                        <div>
                            <h3 className="text-2xl font-bold text-white mb-2">Harmonic Mixing</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                No more key clashes. We use the Camelot Wheel to ensure every track transition is harmonically compatible, creating a seamless, musical journey.
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}

"use client";

import { motion } from "framer-motion";
import { Headphones, PartyPopper, Activity, Radio, ArrowRight } from "lucide-react";

const useCases = [
    {
        icon: Headphones,
        title: "The Bedroom DJ",
        description: "Instant crate-digging. Get 30 harmonically compatible tracks to load into your deck and start mixing immediately.",
        delay: 0.1
    },
    {
        icon: PartyPopper,
        title: "The Party Host",
        description: "A setlist that reads the room. Starts chill for dinner, builds up for the dancefloor, and cools down for the Uber ride home.",
        delay: 0.2
    },
    {
        icon: Activity,
        title: "The Runner",
        description: "Pace your workout with precision. Warm-up tracks, high-BPM bangers for the sprints, and a recovery cooldown.",
        delay: 0.3
    },
    {
        icon: Radio,
        title: "The Curator",
        description: "Create professional-sounding radio shows or playlists with transitions so smooth your listeners won't skip a beat.",
        delay: 0.4
    }
];

export function UseCasesSection() {
    return (
        <section className="w-full max-w-5xl mx-auto py-24 px-4 border-t border-white/5">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
                <div className="space-y-4">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
                        Who is this for?
                    </h2>
                    <p className="text-lg text-muted-foreground">
                        Whether you're mixing, hosting, or training.
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {useCases.map((useCase, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: useCase.delay }}
                        className="group p-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 transition-all cursor-default"
                    >
                        <div className="mb-4 p-3 rounded-xl bg-blue-500/10 w-fit group-hover:bg-blue-500/20 transition-colors">
                            <useCase.icon className="w-6 h-6 text-blue-400" />
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">{useCase.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {useCase.description}
                        </p>
                    </motion.div>
                ))}
            </div>

            {/* Call to Action at Bottom */}
            <div className="mt-24 text-center">
                <p className="text-white/40 mb-4 text-sm font-mono uppercase tracking-widest">Ready to find your flow?</p>
                <button
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="inline-flex items-center gap-2 text-white font-bold hover:text-blue-400 transition-colors"
                >
                    Scroll to Top <ArrowRight className="w-4 h-4" />
                </button>
            </div>
        </section>
    );
}

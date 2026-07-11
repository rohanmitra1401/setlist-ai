"use client";

import { Headphones, PartyPopper, Activity, Radio } from "lucide-react";

const useCases = [
    {
        icon: Headphones,
        title: "Bedroom DJs",
        description: "30 compatible tracks, ready to load into the deck.",
    },
    {
        icon: PartyPopper,
        title: "Party hosts",
        description: "Dinner-chill to dancefloor to wind-down, automatically.",
    },
    {
        icon: Activity,
        title: "Runners",
        description: "Warm-up, high-BPM sprints, recovery cooldown.",
    },
    {
        icon: Radio,
        title: "Curators",
        description: "Radio-grade transitions your listeners won't skip.",
    },
];

export function UseCasesSection() {
    return (
        <section className="mt-20">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10 gap-y-8">
                {useCases.map((u) => (
                    <div key={u.title} className="flex items-start gap-3">
                        <u.icon className="w-4 h-4 text-accent mt-0.5 shrink-0" strokeWidth={1.5} />
                        <div>
                            <h3 className="text-sm font-medium mb-1">{u.title}</h3>
                            <p className="text-[13px] text-muted leading-relaxed">{u.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

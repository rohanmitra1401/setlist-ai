
import { TrackWithFeatures, generateSetlist } from "./src/lib/setlist-logic";

// Mock Data
const createTrack = (id: string, bpm: number, camelot: string = "8A", energy: number = 0.5, vibeScore: number = 50): TrackWithFeatures => ({
    id,
    name: `Track ${id}`,
    artist: "Artist",
    uri: `spotify:track:${id}`,
    bpm,
    energy,
    valence: 0.5,
    key: 0,
    mode: 1,
    camelot,
    danceability: 0.5,
    vibeScore
});

console.log("\n>>> TESTING ADVANCED SETLIST LOGIC <<<\n");

// Case 1: Effective BPM (Half-Time/Double-Time)
console.log("--- Test 1: Effective BPM (Half/Double Time) ---");
const bpmTracks = [
    createTrack("perfect", 140, "8A"),
    createTrack("half", 70, "8A"),     // Should be treated as 140
    createTrack("double", 280, "8A"),  // Should be treated as 140
    createTrack("bad", 100, "8A"),     // Should be rejected/low rank
];
const result1 = generateSetlist(bpmTracks, { targetBpm: 140 });
console.log(`Target: 140 BPM.`);
result1.forEach((t, i) => console.log(`${i + 1}. ${t.name}: ${t.bpm} BPM`));
// Expect: perfect, half, double (in any order probably), then bad (or bad filtered out if list full)

// Case 2: Energy Boost Logic
console.log("\n--- Test 2: Energy Boost Logic (+2 Camelot) ---");
// We need a sequence. The logic prioritizes +2 Jumps during "Build" phases (index 6-12).
// Let's create enough tracks to reach build phase.
const baseTracks = Array.from({ length: 5 }, (_, i) => createTrack(`warmup-${i}`, 140, "8A", 0.4)); // Warmup
// For build, we have candidates:
const buildCandidates = [
    createTrack("boost", 140, "10A", 0.8), // +2 Jump (Energy Boost!)
    createTrack("flat", 140, "8A", 0.8),   // Same Key
    createTrack("clash", 140, "3B", 0.8),  // Clash
];

const allBoostTracks = [...baseTracks, ...buildCandidates];
// Note: We need enough tracks to trigger the build phase logic strictly? 
// The logic runs for `targetLength`. 
// If we simulate a smaller set, indexes still map to phases.
// 8 tracks total.
// 0-5 Warmup. 6-7 Build.
const result2 = generateSetlist(allBoostTracks, { targetBpm: 140 });

console.log(`Checking sequences (Full List):`);
result2.forEach((t, i) => {
    console.log(`${i + 1}. ${t.name} [${t.camelot}] Energy:${t.energy} BPM:${t.bpm}`);
});

// Case 4: Randomness Check
console.log("\n--- Test 4: Randomness Check (Run twice) ---");
const cloneTracks = Array.from({ length: 50 }, (_, i) => createTrack(`clone-${i}`, 140, "8A", 0.5, 50));
// All independent identical tracks.
const run1 = generateSetlist(cloneTracks, { targetBpm: 140 });
const run2 = generateSetlist(cloneTracks, { targetBpm: 140 });

console.log(`Run 1 First Track: ${run1[0]?.id}`);
console.log(`Run 2 First Track: ${run2[0]?.id}`);
if (run1[0]?.id !== run2[0]?.id) {
    console.log("SUCCESS: Different start tracks selected (Randomness working).");
} else {
    console.log("WARNING: Same start track. Might be coincidence or lack of entropy.");
}
console.log("\n--- Test 3: Wave Energy Flow ---");
// Create a pool of varied energy tracks
const wavePool = Array.from({ length: 40 }, (_, i) => {
    const energy = Math.random();
    return createTrack(`gen-${i}`, 140, "8A", energy);
});

const result3 = generateSetlist(wavePool, { targetBpm: 140 });
console.log("Energy Curve Output:");
const energyCurve = result3.map(t => t.energy.toFixed(2)).join(", ");
console.log(energyCurve);
// Expect: Low -> High -> Higher -> Drop -> High -> Drop



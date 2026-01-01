
// Types
export interface TrackWithFeatures {
    id: string;
    name: string;
    artist: string;
    uri: string;
    bpm: number;
    energy: number;
    valence: number;
    key: number;
    mode: number; // 1=Major, 0=Minor
    camelot: string; // e.g. "8A", "5B"
    danceability: number;
    image?: string;
    vibeScore?: number; // 0-100
}

export interface MoodInput {
    targetBpm: number;
    startVibe?: "low" | "medium" | "high";
}

// ----------------------------------------------------------------------

// ----------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------

/**
 * Calculates the "Effective BPM Distance" considering Half-Time and Double-Time.
 * e.g. Target 140. Track 70 -> Distance 0. Track 140 -> Distance 0.
 */
function getEffectiveBpmDistance(trackBpm: number, targetBpm: number): number {
    if (!trackBpm || !targetBpm) return 100; // Penalty for missing data

    const diff1x = Math.abs(trackBpm - targetBpm);
    const diff2x = Math.abs((trackBpm * 2) - targetBpm); // Track is half-time (e.g. 70 vs 140)
    const diff05x = Math.abs((trackBpm * 0.5) - targetBpm); // Track is double-time (e.g. 280 vs 140)

    return Math.min(diff1x, diff2x, diff05x);
}

/**
 * Advanced Harmonic Scoring
 * Lower is Better.
 * 0 = Perfect / Energy Boost
 * 10 = Compatible
 * 100 = Clash
 */
function getHarmonicScore(
    currentCamelot: string,
    nextCamelot: string,
    isBuildingEnergy: boolean
): number {
    if (!currentCamelot || !nextCamelot || currentCamelot === "Unknown" || nextCamelot === "Unknown") return 50; // Neutral penalty
    if (currentCamelot === nextCamelot) return 0; // Perfect match

    const numA = parseInt(currentCamelot.slice(0, -1));
    const letterA = currentCamelot.slice(-1);
    const numB = parseInt(nextCamelot.slice(0, -1));
    const letterB = nextCamelot.slice(-1);

    // 1. Same Number, Diff Letter (8A <-> 8B) - "Mood Shift"
    if (numA === numB && letterA !== letterB) return 10;

    // 2. Adjacent +/- 1 (8A <-> 9A/7A)
    let dist = Math.abs(numA - numB);
    if (dist === 11) dist = 1; // Wrap 12-1

    if (dist === 1 && letterA === letterB) return 5; // Good mixing

    // 3. ENERGY BOOST (+2 Semitones / +2 Numbers) e.g. 8A -> 10A
    // or +7 Semitones?? No, usually +2 numbers (+7 semitones is circle of fifths opposite side?)
    // Actually +1 Semitone = +7 Numbers on Camelot
    // +2 Semitones = +2 Numbers on Camelot
    // Expert advice: +2 Numbers (e.g. 8A -> 10A) is a great energy boost.

    // Check for +2 Jump (Clockwise)
    let clockwiseDist = numB - numA;
    if (clockwiseDist < 0) clockwiseDist += 12;

    if (letterA === letterB) {
        if (clockwiseDist === 2 && isBuildingEnergy) return 0; // REWARD Energy Boost!
        if (clockwiseDist === 7 && isBuildingEnergy) return 0; // +1 Semitone boost (sometimes)
    }

    return 100; // Clash
}


// ----------------------------------------------------------------------
// 2. Selection & Scoring
// ----------------------------------------------------------------------

/**
 * Select top candidates using weighted scoring instead of hard filters.
 */
function selectTopCandidateTracks(
    allTracks: TrackWithFeatures[],
    targetBpm: number
): TrackWithFeatures[] {

    const candidates = allTracks.map(track => {
        const bpmDist = getEffectiveBpmDistance(track.bpm, targetBpm);

        // Base Score formula:
        // VibeScore (0-100) is good. BPM Dist (0-inf) is bad.
        // We want high score.
        // Score = (VibeScore * 2) - (BpmDist * 5)

        let score = (track.vibeScore || 0) * 2;
        score -= (bpmDist * 10); // VERY Heavy penalty for bad BPM

        // Add random jitter to prevent deterministic sorting
        score += (Math.random() * 10);

        return { track, score };
    });

    // Sort by Score Descending
    candidates.sort((a, b) => b.score - a.score);

    // Take top 50, but ignore ones with REALLY bad scores (optional)
    return candidates.slice(0, 50).map(c => c.track);
}


// ----------------------------------------------------------------------
// 3. Sorting Algorithm (Wave Structure)
// ----------------------------------------------------------------------

/**
 * Wave Structure for 30 songs:
 * 0-5: Warmup (0.3 -> 0.6)
 * 6-12: Build 1 (0.6 -> 0.9)
 * 13-16: Peak 1 (0.9 -> 1.0)
 * 17-20: Reset (1.0 -> 0.6)
 * 21-26: Build 2 (0.6 -> 0.95)
 * 27-29: Outro (0.95 -> 0.5)
 */
function getTargetEnergy(index: number, total: number): number {
    const progress = index / total;

    if (progress < 0.2) return 0.3 + (progress / 0.2) * 0.3; // 0.3 -> 0.6
    if (progress < 0.45) return 0.6 + ((progress - 0.2) / 0.25) * 0.3; // 0.6 -> 0.9
    if (progress < 0.55) return 0.9 + ((progress - 0.45) / 0.1) * 0.1; // 0.9 -> 1.0
    if (progress < 0.65) return 1.0 - ((progress - 0.55) / 0.1) * 0.4; // 1.0 -> 0.6 (Reset)
    if (progress < 0.9) return 0.6 + ((progress - 0.65) / 0.25) * 0.35; // 0.6 -> 0.95
    return 0.95 - ((progress - 0.9) / 0.1) * 0.45; // 0.95 -> 0.5 (Outro)
}

function isBuildingPhase(index: number, total: number): boolean {
    const progress = index / total;
    // Build phases are 0.2-0.45 and 0.65-0.9
    return (progress >= 0.2 && progress < 0.45) || (progress >= 0.65 && progress < 0.9);
}

export function generateSetlist(
    allTracks: TrackWithFeatures[],
    moodInput: MoodInput
): TrackWithFeatures[] {

    // DEBUG: Log input BPM distribution
    const inputBpms = allTracks.map(t => t.bpm).filter(b => b > 0);
    const avgInputBpm = inputBpms.length > 0 ? inputBpms.reduce((a, b) => a + b, 0) / inputBpms.length : 0;
    console.log(`[SetlistGen] Input: ${allTracks.length} tracks. Target BPM: ${moodInput.targetBpm}. Avg Input BPM: ${avgInputBpm.toFixed(1)}`);

    const pool = selectTopCandidateTracks(allTracks, moodInput.targetBpm);
    const targetLength = Math.min(pool.length, 30);

    // DEBUG: Log pool BPM distribution
    const poolBpms = pool.map(t => t.bpm).filter(b => b > 0);
    const avgPoolBpm = poolBpms.length > 0 ? poolBpms.reduce((a, b) => a + b, 0) / poolBpms.length : 0;
    const matchingBpmCount = allTracks.filter(t => getEffectiveBpmDistance(t.bpm, moodInput.targetBpm) <= 10).length;
    console.log(`[SetlistGen] Pool: ${pool.length} tracks. Avg Pool BPM: ${avgPoolBpm.toFixed(1)}. Tracks within ±10 BPM (effective): ${matchingBpmCount}`);

    if (targetLength === 0) return [];

    const sortedParams: TrackWithFeatures[] = [];
    const usedIds = new Set<string>();

    // 1. Pick First Song (Closest to Warmup Energy + Target BPM)
    let bestStart: TrackWithFeatures | null = null;
    let bestStartScore = Infinity;

    for (const track of pool) {
        const bpmDist = getEffectiveBpmDistance(track.bpm, moodInput.targetBpm);
        const energyDist = Math.abs(track.energy - getTargetEnergy(0, targetLength));

        // Lower is better
        const score = (bpmDist * 2) + (energyDist * 10);

        if (score < bestStartScore) {
            bestStartScore = score;
            bestStart = track;
        }
    }

    if (bestStart) {
        sortedParams.push(bestStart);
        usedIds.add(bestStart.id);
    }

    // 2. Pick Subsequent Songs
    for (let i = 1; i < targetLength; i++) {
        const prevTrack = sortedParams[i - 1];
        if (!prevTrack) break;

        const targetEnergy = getTargetEnergy(i, targetLength);
        const isBuilding = isBuildingPhase(i, targetLength);

        let bestNext: TrackWithFeatures | null = null;
        let bestNextScore = Infinity;

        // Weights
        const W_ENERGY = 15;
        const W_BPM = 20; // High penalty for drifting BPM
        const W_HARMONIC = 10;
        const W_VIBE = 5;

        for (const track of pool) {
            if (usedIds.has(track.id)) continue;

            // 1. Energy Fit
            const energyDiff = Math.abs(track.energy - targetEnergy);

            // 2. BPM Fit (Relative to PREVIOUS track to ensure flow, AND Global Target)
            // We want to flow from previous, but also stay near global target
            const flowBpmDist = getEffectiveBpmDistance(track.bpm, prevTrack.bpm);

            // 3. Harmonic
            const harmonicScore = getHarmonicScore(prevTrack.camelot, track.camelot, isBuilding);

            // 4. Vibe (Reuse existing score or calculate fresh)
            const vibePenalty = (100 - (track.vibeScore || 0)) / 100; // 0.0 to 1.0

            // TOTAL SCORE (Lower is Better)
            // Note: If flowBpmDist is huge (>10), we massive penalize
            const bpmPenalty = flowBpmDist > 10 ? 1000 : flowBpmDist;

            const totalScore =
                (energyDiff * W_ENERGY) +
                (bpmPenalty * W_BPM) +
                (harmonicScore * W_HARMONIC) +
                (vibePenalty * W_VIBE);

            if (totalScore < bestNextScore) {
                bestNextScore = totalScore;
                bestNext = track;
            }
        }

        if (bestNext) {
            sortedParams.push(bestNext);
            usedIds.add(bestNext.id);
        } else {
            break; // Should ideally not happen with soft scoring
        }
    }

    return sortedParams;
}

// Deprecated helpers removed (findBestMatch, findFallbackTrack) as logic is now integrated.


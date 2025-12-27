
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
// Helpers
// ----------------------------------------------------------------------

/**
 * Checks if two Camelot keys are compatible.
 * Rules:
 * 1. Exact Match (8A -> 8A)
 * 2. +/- 1 Number, Same Letter (8A -> 9A, 8A -> 7A) (Handles 12->1 wrapping)
 * 3. Same Number, Different Letter (8A -> 8B)
 */
function isHarmonicallyCompatible(codeA: string, codeB: string): boolean {
    if (!codeA || !codeB || codeA === "Unknown" || codeB === "Unknown") return false;
    if (codeA === codeB) return true;

    const numA = parseInt(codeA.slice(0, -1));
    const letterA = codeA.slice(-1);
    const numB = parseInt(codeB.slice(0, -1));
    const letterB = codeB.slice(-1);

    // Rule 3: Relative Major/Minor (Same Number, Different Letter)
    if (numA === numB && letterA !== letterB) return true;

    // Rule 2: Adjacent Number, Same Letter
    if (letterA === letterB) {
        const diff = Math.abs(numA - numB);
        if (diff === 1) return true;
        // Wrap around 12 -> 1
        if ((numA === 12 && numB === 1) || (numA === 1 && numB === 12)) return true;
    }

    return false;
}


// ----------------------------------------------------------------------
// 2. Selection & Scoring
// ----------------------------------------------------------------------

/**
 * Filter and select top 30 tracks based on VIBE SCORE and BPM compatibility.
 */
function selectTopCandidateTracks(
    allTracks: TrackWithFeatures[],
    targetBpm: number
): TrackWithFeatures[] {
    // 1. Filter out tracks that are waaaay off (e.g. +/- 20 BPM)
    let validTracks = allTracks.filter(
        (t) => Math.abs(t.bpm - targetBpm) <= 20
    );

    // If too aggressive, loosen up
    if (validTracks.length < 30) {
        validTracks = allTracks.filter((t) => Math.abs(t.bpm - targetBpm) <= 40);
    }
    if (validTracks.length < 30) {
        validTracks = allTracks;
    }

    // 2. Sort primarily by Vibe Score (High to Low), then by BPM proximity
    validTracks.sort((a, b) => {
        // Vibe Score (descending)
        const vibeDiff = (b.vibeScore || 0) - (a.vibeScore || 0);
        if (Math.abs(vibeDiff) > 10) return vibeDiff;

        // Otherwise prefer closer BPM
        const distA = Math.abs(a.bpm - targetBpm);
        const distB = Math.abs(b.bpm - targetBpm);
        return distA - distB;
    });

    // 3. Take top 40-50
    return validTracks.slice(0, 50);
}


// ----------------------------------------------------------------------
// 3. Sorting Algorithm (Parabolic Energy + BPM Constraints)
// ----------------------------------------------------------------------

/**
 * Ideal Energy Curve:
 * - Starts Low (Index 0 ~ 0.3/0.4)
 * - Peaks at Index 21 (Song 22) ~ 0.9/1.0
 * - Drops at End (Index 29) ~ 0.5
 */
function getTargetEnergy(index: number, total: number): number {
    if (total === 1) return 0.5;

    // Peak at ~70-75% of the set
    const peakIndex = Math.floor(total * 0.73);

    if (index <= peakIndex) {
        // Ramp up phase
        const progress = index / peakIndex;
        // Lerp from 0.4 to 0.95
        return 0.4 + (0.95 - 0.4) * (progress * progress); // slight exp curve
    } else {
        // Cooldown phase
        const progress = (index - peakIndex) / (total - 1 - peakIndex);
        // Lerp from 0.95 down to 0.6
        return 0.95 - (0.35) * progress;
    }
}

export function generateSetlist(
    allTracks: TrackWithFeatures[],
    moodInput: MoodInput
): TrackWithFeatures[] {

    const pool = selectTopCandidateTracks(allTracks, moodInput.targetBpm);
    const targetLength = Math.min(pool.length, 30);

    const sortedParams: TrackWithFeatures[] = [];
    const usedIds = new Set<string>();

    // --- Greedy Approach with Constraints ---

    // 1. Pick First Song
    let bestStart = findBestMatch(
        pool,
        usedIds,
        getTargetEnergy(0, targetLength),
        moodInput.targetBpm,
        null // no previous track
    );

    if (!bestStart) return []; // Should not happen unless empty pool

    sortedParams.push(bestStart);
    usedIds.add(bestStart.id);

    // 2. Pick Subsequent Songs
    for (let i = 1; i < targetLength; i++) {
        const prevTrack = sortedParams[i - 1];
        const desiredEnergy = getTargetEnergy(i, targetLength);

        // Find best match in pool
        const nextTrack = findBestMatch(
            pool,
            usedIds,
            desiredEnergy,
            moodInput.targetBpm,
            prevTrack
        );

        if (nextTrack) {
            sortedParams.push(nextTrack);
            usedIds.add(nextTrack.id);
        } else {
            // SOFT FALLBACK: Find "least bad" BPM jump 
            const fallback = findFallbackTrack(pool, usedIds, prevTrack);
            if (fallback) {
                sortedParams.push(fallback);
                usedIds.add(fallback.id);
            } else {
                break; // No more songs available
            }
        }
    }

    return sortedParams;
}

function findBestMatch(
    pool: TrackWithFeatures[],
    usedIds: Set<string>,
    targetEnergy: number,
    globalTargetBpm: number,
    prevTrack: TrackWithFeatures | null
): TrackWithFeatures | null {

    let bestTrack: TrackWithFeatures | null = null;
    let bestScore = Infinity;

    for (const track of pool) {
        if (usedIds.has(track.id)) continue;

        let isHarmonic = false;

        // CONSTRAINT: BPM Jump (+/- 5) check
        if (prevTrack) {
            const bpmDiff = Math.abs(track.bpm - prevTrack.bpm);
            if (bpmDiff > 5) continue;

            // CONSTRAINT: Harmonic Mixing
            isHarmonic = isHarmonicallyCompatible(track.camelot, prevTrack.camelot);

            // Allow reverse compatibility too (A->B is same as B->A logic wise here) (?)
            // Actually Camelot wheel is directed? No, compatibility is symmetric usually for simple adjacencies.
            // But let's stick to our helper.

            if (!isHarmonic) {
                continue;
            }
        } else {
            isHarmonic = true;
        }

        // SCORE: Energy Proximity + Vibe Score
        const energyDiff = Math.abs(track.energy - targetEnergy);
        const vibeBonus = (track.vibeScore || 0) / 200; // 0.0 - 0.5 benefit

        // Lower score is better. Energy Diff is 0-1. VibeBonus subtracts from score.
        const score = energyDiff - vibeBonus;

        if (score < bestScore) {
            bestScore = score;
            bestTrack = track;
        }
    }

    return bestTrack;
}

function findFallbackTrack(
    pool: TrackWithFeatures[],
    usedIds: Set<string>,
    prevTrack: TrackWithFeatures
): TrackWithFeatures | null {
    // Just find the one with the smallest BPM jump, ignoring energy curve
    let bestTrack: TrackWithFeatures | null = null;
    let minBpmDiff = Infinity;

    for (const track of pool) {
        if (usedIds.has(track.id)) continue;

        const bpmDiff = Math.abs(track.bpm - prevTrack.bpm);
        let score = bpmDiff;

        // Slight tie-breaker for Harmonic if available
        if (isHarmonicallyCompatible(prevTrack.camelot, track.camelot)) {
            score -= 5;
        }

        if (score < minBpmDiff) {
            minBpmDiff = score;
            bestTrack = track;
        }
    }

    return bestTrack;
}

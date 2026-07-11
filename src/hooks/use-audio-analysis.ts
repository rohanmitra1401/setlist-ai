"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { findTrackPreview } from "@/app/actions-itunes";
import { TrackWithFeatures } from "@/lib/setlist-engine";

// Helper for Camelot Key
const getCamelotKey = (key: string, scale: string): string => {
    const lookupKey = key.toLowerCase();
    const isMajor = scale === 'major';

    const majorMap: Record<string, string> = {
        'b': '1B', 'f#': '2B', 'gb': '2B', 'c#': '3B', 'db': '3B',
        'g#': '4B', 'ab': '4B', 'd#': '5B', 'eb': '5B', 'a#': '6B', 'bb': '6B',
        'f': '7B', 'c': '8B', 'g': '9B', 'd': '10B', 'a': '11B', 'e': '12B'
    };

    const minorMap: Record<string, string> = {
        'g#': '1A', 'ab': '1A', 'd#': '2A', 'eb': '2A', 'a#': '3A', 'bb': '3A',
        'f': '4A', 'c': '5A', 'g': '6A', 'd': '7A', 'a': '8A', 'e': '9A',
        'b': '10A', 'f#': '11A', 'gb': '11A', 'c#': '12A', 'db': '12A'
    };

    return isMajor ? (majorMap[lookupKey] || key) : (minorMap[lookupKey] || key);
};

export type AnalysisStatus = "idle" | "loading_scripts" | "analyzing" | "complete" | "error";

/**
 * Correct octave errors in beat detection.
 * Beat trackers sometimes lock onto the half- or double-beat (e.g. reporting
 * 69.6 for a 139 BPM track). If a catalog BPM is available (Deezer), use it to
 * arbitrate: pick whichever of {raw, raw*2, raw/2} is closest, and if that's
 * within 8% of catalog, trust the catalog value. Otherwise fold the measured
 * value into the 85-170 dance range.
 */
const correctBpm = (raw: number, catalog: number): number => {
    if (!raw || raw <= 0) return catalog || 0;

    if (catalog > 0) {
        const candidates = [raw, raw * 2, raw / 2];
        const closest = candidates.reduce((a, b) =>
            Math.abs(b - catalog) < Math.abs(a - catalog) ? b : a
        );
        if (Math.abs(closest - catalog) / catalog < 0.08) return catalog;
    }

    let bpm = raw;
    while (bpm < 85) bpm *= 2;
    while (bpm > 170) bpm /= 2;
    return bpm;
};

export function useAudioAnalysis() {
    const [status, setStatus] = useState<AnalysisStatus>("idle");
    const [progress, setProgress] = useState(0); // 0-100
    const [currentTrackName, setCurrentTrackName] = useState("");
    const [analyzedTracks, setAnalyzedTracks] = useState<TrackWithFeatures[]>([]);

    // Refs for Essentia
    const audioContextRef = useRef<AudioContext | null>(null);
    const essentiaRef = useRef<any>(null);
    const isScriptLoaded = useRef(false);

    // Initialize Essentia (Lazy Load)
    const initEssentia = useCallback(async () => {
        if (essentiaRef.current) return true;

        try {
            if (typeof window === "undefined") return false;

            // Check if scripts are global yet
            if (!window.EssentiaWASM || !window.Essentia) {
                console.log("Waiting for Essentia scripts...");
                // In a real app we might dynamically inject scripts here if not present
                // For now, we assume they are in layout or page
                return false;
            }

            // Init AudioContext
            // CRITICAL: Essentia's algorithms assume 44100 Hz. Without this option the
            // context uses the hardware rate (often 48000 Hz) and decodeAudioData
            // resamples to it, deflating every measured BPM by ~8.8% and shifting keys.
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 44100 });
            }

            // Init WASM
            const factory = typeof window.EssentiaWASM === 'function'
                ? window.EssentiaWASM
                : window.EssentiaWASM.EssentiaWASM;

            const essentiaWasmModule = await factory({
                locateFile: (path: string, prefix: string) => {
                    if (path.endsWith(".wasm")) return "/essentia/" + path;
                    return prefix + path;
                }
            });

            essentiaRef.current = new window.Essentia(essentiaWasmModule);
            isScriptLoaded.current = true;
            return true;
        } catch (e) {
            console.error("Essentia Init Failed", e);
            return false;
        }
    }, []);


    // Caching Helpers
    const getCachedAnalysis = (trackId: string): TrackWithFeatures | null => {
        try {
            const key = `setlist_analysis_v3_${trackId}`;
            const cached = localStorage.getItem(key);
            if (cached) {
                const t = JSON.parse(cached);
                // Apply octave correction to entries cached before it existed
                return { ...t, bpm: correctBpm(t.bpm, 0) };
            }
        } catch (e) {
            console.warn("Cache read error", e);
        }
        return null;
    };

    const saveAnalysisToCache = (track: TrackWithFeatures) => {
        try {
            const key = `setlist_analysis_v3_${track.id}`;
            localStorage.setItem(key, JSON.stringify(track));
        } catch (e) {
            console.warn("Cache write error", e);
        }
    };

    // Analyze a single track
    const analyzeTrack = async (track: TrackWithFeatures): Promise<TrackWithFeatures> => {
        // 0. Check Cache
        const cached = getCachedAnalysis(track.id);
        if (cached) {
            // console.log(`Cache hit for ${track.name}`);
            return cached;
        }

        // Fallback for missing Essentia
        if (!essentiaRef.current) return track;

        try {
            // 1. Find a preview (iTunes -> Deezer cascade, fuzzy-matched)
            const preview = await findTrackPreview(track.artist, track.name);

            if (!preview.previewUrl) {
                console.warn(`No preview found for ${track.name}`);
                return track;
            }

            // 2. Fetch Audio
            const response = await fetch(preview.previewUrl);
            const arrayBuffer = await response.arrayBuffer();

            // 3. Decode
            const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

            // 4. Optimize (Slice 15s for faster analysis)
            const durationLimit = 15;
            const channelData = audioBuffer.getChannelData(0).slice(0, audioBuffer.sampleRate * durationLimit);

            // 5. Analyze - Extract BPM, Key, Energy (RMS), and Danceability
            const vector = essentiaRef.current.arrayToVector(channelData);

            const rhythmExtractor = essentiaRef.current.RhythmExtractor2013(vector);
            // Octave-correct the measured BPM, arbitrating with Deezer catalog BPM
            const bpm = correctBpm(rhythmExtractor.bpm, preview.knownBpm);
            const danceability = rhythmExtractor.danceability || 0.5; // Essentia basic danceability

            const keyExtractor = essentiaRef.current.KeyExtractor(vector);
            const key = keyExtractor.key;
            const scale = keyExtractor.scale;
            const camelot = getCamelotKey(key, scale);

            // Calculate Energy using RMS (Root Mean Square)
            // Essentia has a 'RMS' algo but we can also just compute it cheaply if needed.
            // Let's use the library algo if available, otherwise manual.
            // Essentia JS usually exposes RMS.
            const rmsAlgo = essentiaRef.current.RMS(vector);
            const rawEnergy = rmsAlgo.rms;

            // Normalize Energy (Empirical observation: RMS usually 0.0 to 0.5 for previews)
            // We'll clamp and scale to 0-1
            const energy = Math.min(1, Math.max(0, rawEnergy * 3));

            vector.delete();
            // rmsAlgo.delete(); // If returned object needs deletion? Usually value or struct.
            // EssentiaJS usually returns object { rms: number }

            // Calculate Vibe Score (Simple heuristic + Randomness to prevent identical sets)
            // High Energy + High Danceability = High Vibe
            const calculatedVibe = (energy * 50) + (danceability * 50);

            // Add jitter (+/- 10) to prevent deterministic sorting of identical tracks
            const jitter = (Math.random() * 20) - 10;
            const vibeScore = Math.max(0, Math.min(100, calculatedVibe + jitter));

            // Return enriched track
            const result = {
                ...track,
                bpm,
                key: 0,
                mode: scale === 'major' ? 1 : 0,
                camelot,
                energy,
                danceability,
                vibeScore
            };

            // Save to Cache
            saveAnalysisToCache(result);
            return result;

        } catch (e) {
            console.warn(`Failed to analyze ${track.name}`, e);
            return track;
        }
    };


    // Main Driver Function (Parallelized)
    const startAnalysis = async (tracks: TrackWithFeatures[]) => {
        setStatus("loading_scripts");
        const ready = await initEssentia();
        if (!ready) {
            console.error("Essentia not ready. Make sure scripts are loaded.");
            setStatus("error");
            return;
        }

        setStatus("analyzing");
        setAnalyzedTracks([]);
        setProgress(0);

        // Purge poisoned v2 cache entries (analyzed at wrong sample rate)
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && k.startsWith("setlist_analysis_v2_")) localStorage.removeItem(k);
            }
        } catch { /* ignore */ }

        const allResults: TrackWithFeatures[] = [];
        const queue = [...tracks];
        let completed = 0;
        const total = tracks.length;

        // Concurrency Control
        const CONCURRENCY_LIMIT = 8;

        const worker = async () => {
            while (queue.length > 0) {
                const track = queue.shift();
                if (!track) break;

                setCurrentTrackName(track.name); // This might flicker with multiple workers, but gives "activity"

                const result = await analyzeTrack(track);
                allResults.push(result);

                completed++;
                setProgress(Math.round((completed / total) * 100));

                // Update UI incrementally (careful with re-renders)
                // We'll update the list every time one finishes for visual feedback
                setAnalyzedTracks((prev) => [...prev, result]);
            }
        };

        const workers = Array.from({ length: CONCURRENCY_LIMIT }, () => worker());
        await Promise.all(workers);

        // Sort results back to original order? 
        // Logic: The setlist algo handles re-sorting anyway, but stability is nice.
        // We can re-sort by the order of 'tracks' input if needed. 
        // Let's implement simple map preservation.

        const resultMap = new Map(allResults.map(t => [t.id, t]));
        const sortedResults = tracks.map(t => resultMap.get(t.id) || t);

        setStatus("complete");
        return sortedResults;
    };

    return {
        startAnalysis,
        status,
        progress,
        currentTrackName,
        analyzedTracks
    };
}

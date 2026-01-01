"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { searchItunesPreview } from "@/app/actions-itunes";
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
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
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
            const key = `setlist_analysis_v2_${trackId}`;
            const cached = localStorage.getItem(key);
            if (cached) return JSON.parse(cached);
        } catch (e) {
            console.warn("Cache read error", e);
        }
        return null;
    };

    const saveAnalysisToCache = (track: TrackWithFeatures) => {
        try {
            const key = `setlist_analysis_v2_${track.id}`;
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
            // 1. Search iTunes
            const query = `${track.artist} ${track.name}`;
            const itunesData = await searchItunesPreview(query);

            if (!itunesData || !itunesData.previewUrl) {
                console.warn(`No preview found for ${track.name}`);
                // Cache failure too? Or just return raw? 
                // Let's cache the raw one so we don't retry forever, maybe with a flag?
                // For now, just return raw.
                return track;
            }

            // 2. Fetch Audio
            const response = await fetch(itunesData.previewUrl);
            const arrayBuffer = await response.arrayBuffer();

            // 3. Decode
            const audioBuffer = await audioContextRef.current!.decodeAudioData(arrayBuffer);

            // 4. Optimize (Slice 15s for faster analysis)
            const durationLimit = 15;
            const channelData = audioBuffer.getChannelData(0).slice(0, audioBuffer.sampleRate * durationLimit);

            // 5. Analyze - Extract BPM, Key, Energy (RMS), and Danceability
            const vector = essentiaRef.current.arrayToVector(channelData);

            const rhythmExtractor = essentiaRef.current.RhythmExtractor2013(vector);
            const bpm = rhythmExtractor.bpm;
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

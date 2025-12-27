"use client";

import { useState, useRef } from "react";
import Script from "next/script";
import { searchItunesPreview } from "@/app/actions-itunes";

// Define Essentia types (globally available after script load)
declare global {
    interface Window {
        EssentiaWASM: any;
        Essentia: any;
    }
}

const TEST_SONGS = [
    "Overmono Bby",
    "Bicep Sundial",
    "MPH Funk Master",
    "The Weeknd Blinding Lights"
];

// Helper to convert key/scale to Camelot code
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


export default function LabPage() {
    const [isReady, setIsReady] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [results, setResults] = useState<{ bpm: number; key: string; scale: string; camelot: string } | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const essentiaRef = useRef<any>(null);

    const log = (msg: string) => setLogs((prev) => [...prev, msg]);

    const handleInit = async () => {
        if (essentiaRef.current) return;

        try {
            if (!window.EssentiaWASM || !window.Essentia) {
                log("Waiting for Essentia scripts...");
                return;
            }

            log("Loading Essentia WASM backend...");
            const factory = typeof window.EssentiaWASM === 'function'
                ? window.EssentiaWASM
                : window.EssentiaWASM.EssentiaWASM;

            const essentiaWasmModule = await factory({
                locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? "/essentia/" + path : prefix + path)
            });

            log("Initializing Essentia JS Core...");
            essentiaRef.current = new window.Essentia(essentiaWasmModule);

            log("Essentia System READY!");
            setIsReady(true);
            if (!audioContextRef.current) audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();

        } catch (e: any) {
            log("Error initializing Essentia: " + e.message);
            console.error(e);
        }
    };

    const processAudioBuffer = (audioBuffer: AudioBuffer) => {
        try {
            const fullChannelData = audioBuffer.getChannelData(0);

            // OPTIMIZATION: Slice to 10 seconds
            const durationLimit = 10; // seconds
            const sampleLimit = audioBuffer.sampleRate * durationLimit;

            // Ensure we don't slice if audio is shorter than 10s (unlikely for preview but good safety)
            const channelData = fullChannelData.slice(0, Math.min(fullChannelData.length, sampleLimit));

            log(`Optimizing: Using first ${durationLimit}s (${channelData.length} samples) of ${audioBuffer.duration.toFixed(1)}s track`);

            const vector = essentiaRef.current.arrayToVector(channelData);

            log("Computing BPM...");
            const rhythmExtractor = essentiaRef.current.RhythmExtractor2013(vector);
            const bpm = rhythmExtractor.bpm;
            log(`BPM Found: ${bpm.toFixed(2)} (Conf: ${rhythmExtractor.confidence.toFixed(2)})`);

            log("Computing Key...");
            const keyExtractor = essentiaRef.current.KeyExtractor(vector);
            const key = keyExtractor.key;
            const scale = keyExtractor.scale;

            const camelot = getCamelotKey(key, scale);
            log(`Key Found: ${key} ${scale} -> ${camelot}`);

            setResults({ bpm, key, scale, camelot });

            vector.delete();
        } catch (e: any) {
            log("Analysis Error: " + e.message);
        }
    };

    const processAudio = async (file: File) => {
        if (!essentiaRef.current || !audioContextRef.current) return;
        setResults(null);
        log(`Processing local file: ${file.name}...`);
        try {
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            processAudioBuffer(audioBuffer);
        } catch (e: any) {
            log("Error processing audio: " + e.message);
        }
    };

    const processRemoteTrack = async (query: string) => {
        if (!essentiaRef.current || !audioContextRef.current) return;
        setResults(null);
        log(`Searching iTunes for: "${query}"...`);
        try {
            const itunesData = await searchItunesPreview(query);
            if (!itunesData || !itunesData.previewUrl) {
                log("❌ No preview found.");
                return;
            }
            log(`✅ Found: ${itunesData.trackName}`);
            const response = await fetch(itunesData.previewUrl);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
            processAudioBuffer(audioBuffer);
        } catch (e: any) {
            log("Error: " + e.message);
        }
    };

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-8 font-sans">
            <Script src="/essentia/essentia-wasm.web.js" strategy="afterInteractive" onLoad={handleInit} />
            <Script src="/essentia/essentia.js-core.js" strategy="afterInteractive" onLoad={handleInit} />

            <div className="max-w-2xl mx-auto space-y-8">
                <header>
                    <h1 className="text-3xl font-bold mb-2">Audio Analysis Lab</h1>
                    <p className="text-gray-400">Prototype: Client-side BPM & Key (Essentia WASM)</p>
                </header>

                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-semibold">Status</h2>
                        <span className={`px-3 py-1 rounded-full text-xs font-mono IsReady ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                            {isReady ? "READY" : "LOADING SCRIPTS..."}
                        </span>
                    </div>
                    <div className="h-64 bg-black rounded-lg p-4 font-mono text-xs text-green-500 overflow-y-auto border border-neutral-800">
                        {logs.map((l, i) => <div key={i}>{"> "}{l}</div>)}
                    </div>
                </div>

                {isReady && (
                    <div className="space-y-6">
                        <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800">
                            <h3 className="font-bold mb-4 flex items-center gap-2">
                                <span>⚡️</span> Optimization Test (10s limit)
                            </h3>
                            <div className="grid gap-3">
                                {TEST_SONGS.map(song => (
                                    <button key={song} onClick={() => processRemoteTrack(song)} className="bg-neutral-800 hover:bg-neutral-700 p-3 rounded-lg text-left transition-colors flex justify-between items-center group">
                                        <span>{song}</span>
                                        <span className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">Analyze &rarr;</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {results && (
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl text-center">
                            <div className="text-sm text-gray-500 mb-1">BPM</div>
                            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                                {Math.round(results.bpm)}
                            </div>
                        </div>
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-xl text-center">
                            <div className="text-sm text-gray-500 mb-1">KEY</div>
                            <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                                {results.camelot}
                            </div>
                            <div className="text-xs text-gray-600 mt-2 font-mono uppercase">
                                {results.key} {results.scale}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

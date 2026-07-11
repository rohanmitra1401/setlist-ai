"use client";
import Script from "next/script";
import { useState } from "react";
import { fetchPlaylistTracksAction, createPlaylistAction } from "@/app/actions";
import { generateSetlist, TrackWithFeatures } from "@/lib/setlist-logic";
import { signIn, signOut, useSession } from "next-auth/react";
import { useAudioAnalysis } from "@/hooks/use-audio-analysis";

// Camelot wheel position -> hue (30° per hour, matching standard wheel colors)
const camelotStyle = (camelot?: string): React.CSSProperties => {
    const m = camelot?.match(/^(\d{1,2})(A|B)$/);
    if (!m) {
        return {
            color: "var(--muted)",
            background: "rgba(255,255,255,0.05)",
            borderColor: "rgba(255,255,255,0.12)",
        };
    }
    const hue = (parseInt(m[1], 10) - 1) * 30;
    const light = m[2] === "B" ? 70 : 60;
    return {
        color: `hsl(${hue} 85% ${light}%)`,
        background: `hsl(${hue} 85% ${light}% / 0.10)`,
        borderColor: `hsl(${hue} 85% ${light}% / 0.35)`,
    };
};

const SpotifyIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
);

// Sparkline of the set's energy arc
const EnergyArc = ({ tracks }: { tracks: TrackWithFeatures[] }) => {
    if (tracks.length < 2) return null;
    const w = 200;
    const h = 36;
    const points = tracks
        .map((t, i) => {
            const x = (i / (tracks.length - 1)) * w;
            const y = h - 3 - Math.min(1, Math.max(0, t.energy || 0)) * (h - 6);
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(" ");
    return (
        <div className="hidden md:flex items-center gap-3">
            <span className="font-mono text-[10px] tracking-widest text-faint">SET ARC</span>
            <svg width={w} height={h} className="overflow-visible">
                <polyline
                    points={points}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="1.5"
                    strokeLinejoin="round"
                    opacity="0.9"
                />
            </svg>
        </div>
    );
};

export function SetlistDashboard() {
    const { data: session } = useSession();
    const [url, setUrl] = useState("");
    const [bpm, setBpm] = useState(128);
    const [vibe, setVibe] = useState<"low" | "medium" | "high">("medium");
    const [setlist, setSetlist] = useState<TrackWithFeatures[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exportLoading, setExportLoading] = useState(false);
    const [exportUrl, setExportUrl] = useState("");
    const [totalTracks, setTotalTracks] = useState(0);
    const [analysisStats, setAnalysisStats] = useState<{ analyzed: number; total: number } | null>(null);

    const handleExportSpotify = async () => {
        if (!setlist) return;
        setExportLoading(true);
        try {
            const trackUris = setlist.map(t => t.uri);
            const name = `Setlist AI - ${new Date().toLocaleDateString()}`;
            const result = await createPlaylistAction(name, trackUris);

            if (result.success && result.url) {
                setExportUrl(result.url);
            } else {
                alert(result.error || "Failed to create playlist");
            }
        } catch (e: any) {
            alert(e.message || "Failed to export");
        } finally {
            setExportLoading(false);
        }
    };

    const downloadFile = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadCSV = () => {
        if (!setlist) return;
        const headers = ["Track Name", "Artist", "BPM", "Key", "Camelot", "Energy"];
        const rows = setlist.map(t =>
            `"${t.name}","${t.artist}",${t.bpm},"${t.key}","${t.camelot}",${t.energy}`
        );
        const csvContent = [headers.join(","), ...rows].join("\n");
        downloadFile(csvContent, "setlist.csv", "text/csv");
    };

    const handleDownloadText = () => {
        if (!setlist) return;
        const textContent = setlist.map((t, i) =>
            `${i + 1}. ${t.name} - ${t.artist} [${Math.round(t.bpm)} BPM] [${t.camelot}]`
        ).join("\n");
        downloadFile(textContent, "setlist.txt", "text/plain");
    };

    // Hybrid Analysis Hook
    const { startAnalysis, status: analysisStatus, progress, currentTrackName } = useAudioAnalysis();

    const handleGenerate = async () => {
        if (!url) {
            setError("Paste a Spotify playlist URL first.");
            return;
        }

        const isMock = url.includes("test") || url.includes("mock");
        if (!session && !isMock) {
            setError("Log in with Spotify to use real playlists.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSetlist(null);
        setExportUrl("");
        setAnalysisStats(null);

        try {
            // 1. Fetch Tracks (Server Side)
            const tracks = await fetchPlaylistTracksAction(url);

            if (tracks.length === 0) {
                setError("No compatible tracks found or playlist is empty.");
                setIsLoading(false);
                return;
            }
            setTotalTracks(tracks.length);

            const estimatedMinutes = Math.ceil(tracks.length * 2 / 60);
            console.log(`[Dashboard] Starting analysis of ${tracks.length} tracks. Estimated time: ~${estimatedMinutes}m`);

            // 2. Client Side Analysis (iTunes/Deezer previews + Essentia)
            const analyzedTracks = await startAnalysis(tracks);

            if (!analyzedTracks || analyzedTracks.length === 0) {
                setError("Analysis failed. Could not analyze tracks.");
                setIsLoading(false);
                return;
            }

            setAnalysisStats({
                analyzed: analyzedTracks.filter(t => t.bpm > 0).length,
                total: tracks.length,
            });

            // 3. Sequencing (Client Side)
            const result = generateSetlist(analyzedTracks, {
                targetBpm: bpm,
                startVibe: vibe,
            });

            if (result.length === 0) {
                setError("No compatible tracks found for that BPM/vibe. Try widening the target.");
            } else {
                setSetlist(result);
            }

        } catch (e: any) {
            console.error(e);
            setError(e.message || "Failed to generate setlist");
        } finally {
            setIsLoading(false);
        }
    };

    const analyzing = analysisStatus === "analyzing";
    const doneCount = totalTracks > 0 ? Math.round((progress / 100) * totalTracks) : 0;

    const vibes = [
        { id: "low", label: "CHILL" },
        { id: "medium", label: "BALANCED" },
        { id: "high", label: "PEAK" },
    ] as const;

    return (
        <div className="w-full">
            {/* Load Essentia Dependencies */}
            <Script src="/essentia/essentia-wasm.web.js" strategy="afterInteractive" />
            <Script src="/essentia/essentia.js-core.js" strategy="afterInteractive" />

            {/* Console panel */}
            <div className="border border-border bg-surface rounded-lg overflow-hidden">
                {/* Panel header */}
                <div className="flex items-center justify-between px-4 md:px-5 py-3 border-b border-border">
                    <span className="font-mono text-[11px] tracking-[0.2em] text-faint">
                        SET PARAMETERS
                    </span>
                    {!session ? (
                        <button
                            onClick={() => signIn("spotify")}
                            className="flex items-center gap-2 font-mono text-[11px] tracking-wider text-[#1DB954] hover:text-[#1ed760] transition-colors"
                        >
                            <SpotifyIcon className="w-4 h-4" />
                            CONNECT SPOTIFY
                        </button>
                    ) : (
                        <div className="flex items-center gap-3">
                            {session?.user?.image && (
                                <img src={session.user.image} alt="" className="w-5 h-5 rounded-full grayscale" />
                            )}
                            <span className="font-mono text-[11px] text-muted hidden sm:inline">
                                {session?.user?.name}
                            </span>
                            <button
                                onClick={() => signOut()}
                                className="font-mono text-[11px] tracking-wider text-faint hover:text-foreground transition-colors"
                            >
                                SIGN OUT
                            </button>
                        </div>
                    )}
                </div>

                {/* Inputs */}
                <div className="p-4 md:p-5 grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-3">
                    <input
                        type="text"
                        placeholder="https://open.spotify.com/playlist/…"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="bg-background border border-border rounded-md px-4 py-3 text-sm font-mono focus:outline-none focus:border-accent/60 transition-colors placeholder:text-faint min-w-0"
                    />

                    {/* BPM stepper */}
                    <div className="flex items-stretch border border-border rounded-md overflow-hidden bg-background">
                        <button
                            onClick={() => setBpm(b => Math.max(60, b - 1))}
                            className="px-3 text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
                            aria-label="Decrease BPM"
                        >
                            −
                        </button>
                        <div className="flex items-baseline gap-1.5 px-2 py-3">
                            <input
                                type="number"
                                value={bpm}
                                onChange={(e) => setBpm(Number(e.target.value))}
                                className="w-12 bg-transparent text-center font-mono text-sm focus:outline-none"
                            />
                            <span className="font-mono text-[10px] text-faint">BPM</span>
                        </div>
                        <button
                            onClick={() => setBpm(b => Math.min(200, b + 1))}
                            className="px-3 text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
                            aria-label="Increase BPM"
                        >
                            +
                        </button>
                    </div>

                    {/* Vibe segmented control */}
                    <div className="flex border border-border rounded-md overflow-hidden bg-background">
                        {vibes.map(v => (
                            <button
                                key={v.id}
                                onClick={() => setVibe(v.id)}
                                className={`px-4 py-3 font-mono text-[11px] tracking-wider transition-colors ${
                                    vibe === v.id
                                        ? "bg-accent-dim text-accent"
                                        : "text-muted hover:text-foreground hover:bg-surface-2"
                                }`}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || analyzing}
                        className="bg-accent text-black font-semibold text-sm px-6 py-3 rounded-md hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98] whitespace-nowrap"
                    >
                        {isLoading ? "Working…" : "Generate Setlist"}
                    </button>
                </div>

                {/* Progress strip */}
                {isLoading && (
                    <div className="px-4 md:px-5 pb-4 space-y-2">
                        <div className="flex items-center justify-between font-mono text-[11px] text-muted">
                            <span className="truncate pr-4">
                                {analyzing
                                    ? `ANALYZING — ${currentTrackName || "…"}`
                                    : "FETCHING PLAYLIST…"}
                            </span>
                            {analyzing && totalTracks > 0 && (
                                <span className="text-accent shrink-0">
                                    {String(doneCount).padStart(3, "0")}/{totalTracks}
                                </span>
                            )}
                        </div>
                        <div className="h-0.5 bg-surface-2 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-accent transition-all duration-300"
                                style={{ width: `${analyzing ? progress : 4}%` }}
                            />
                        </div>
                    </div>
                )}

                {error && (
                    <div className="mx-4 md:mx-5 mb-4 px-4 py-3 rounded-md bg-red-500/8 border border-red-500/25 text-red-300 font-mono text-xs">
                        {error}
                    </div>
                )}
            </div>

            {/* Results */}
            {setlist && (
                <div className="mt-12">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-4">
                            <h2 className="font-mono text-[11px] tracking-[0.2em] text-faint">
                                OUTPUT — {setlist.length} TRACKS
                            </h2>
                            {analysisStats && (
                                <span
                                    className={`font-mono text-[11px] ${
                                        analysisStats.analyzed < analysisStats.total
                                            ? "text-amber-400/80"
                                            : "text-faint"
                                    }`}
                                    title={
                                        analysisStats.analyzed < analysisStats.total
                                            ? "Some tracks had no preview available and were excluded from analysis"
                                            : undefined
                                    }
                                >
                                    ANALYZED {analysisStats.analyzed}/{analysisStats.total}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-6">
                            <EnergyArc tracks={setlist} />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDownloadCSV}
                                    className="font-mono text-[11px] tracking-wider border border-border hover:border-border-strong text-muted hover:text-foreground px-3 py-2 rounded-md transition-colors"
                                >
                                    CSV
                                </button>
                                <button
                                    onClick={handleDownloadText}
                                    className="font-mono text-[11px] tracking-wider border border-border hover:border-border-strong text-muted hover:text-foreground px-3 py-2 rounded-md transition-colors"
                                >
                                    TXT
                                </button>
                                {exportUrl ? (
                                    <a
                                        href={exportUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 font-mono text-[11px] tracking-wider bg-[#1DB954] text-black font-semibold px-4 py-2 rounded-md hover:brightness-110 transition-all"
                                    >
                                        <SpotifyIcon className="w-3.5 h-3.5" />
                                        OPEN PLAYLIST
                                    </a>
                                ) : (
                                    <button
                                        onClick={handleExportSpotify}
                                        disabled={exportLoading}
                                        className="flex items-center gap-2 font-mono text-[11px] tracking-wider bg-foreground text-black font-semibold px-4 py-2 rounded-md hover:bg-white/85 transition-colors disabled:opacity-50"
                                    >
                                        <SpotifyIcon className="w-3.5 h-3.5" />
                                        {exportLoading ? "SAVING…" : "SAVE TO SPOTIFY"}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="border border-border rounded-lg overflow-hidden bg-surface">
                        {/* Column headers */}
                        <div className="hidden sm:grid grid-cols-[2.5rem_3rem_1fr_4rem_5.5rem_6rem] items-center gap-4 px-4 py-2.5 border-b border-border font-mono text-[10px] tracking-[0.15em] text-faint">
                            <span>#</span>
                            <span />
                            <span>TRACK</span>
                            <span className="text-right">KEY</span>
                            <span className="text-right">BPM</span>
                            <span className="text-right">ENERGY</span>
                        </div>
                        <div className="overflow-y-auto max-h-[600px] slim-scroll divide-y divide-border">
                            {setlist.map((track, i) => {
                                const prev = i > 0 ? setlist[i - 1] : null;
                                const delta = prev ? Math.round(track.bpm) - Math.round(prev.bpm) : 0;
                                return (
                                    <div
                                        key={`${track.id}-${i}`}
                                        className="grid grid-cols-[2.5rem_3rem_1fr] sm:grid-cols-[2.5rem_3rem_1fr_4rem_5.5rem_6rem] items-center gap-4 px-4 py-3 hover:bg-surface-2 transition-colors group"
                                    >
                                        <span className="font-mono text-xs text-faint">
                                            {(i + 1).toString().padStart(2, "0")}
                                        </span>

                                        <div className="relative w-10 h-10 rounded overflow-hidden bg-surface-2">
                                            {track.image ? (
                                                <img
                                                    src={track.image}
                                                    alt=""
                                                    className="w-full h-full object-cover saturate-50 group-hover:saturate-100 transition-all"
                                                />
                                            ) : (
                                                <div className="w-full h-full" />
                                            )}
                                        </div>

                                        <div className="min-w-0">
                                            <h3 className="text-sm font-medium truncate">{track.name}</h3>
                                            <p className="text-xs text-muted truncate">{track.artist}</p>
                                        </div>

                                        <div className="hidden sm:flex justify-end">
                                            <span
                                                className="font-mono text-[11px] px-2 py-0.5 rounded border"
                                                style={camelotStyle(track.camelot)}
                                            >
                                                {track.camelot || "—"}
                                            </span>
                                        </div>

                                        <div className="hidden sm:flex items-baseline justify-end gap-1.5">
                                            <span className="font-mono text-sm">{Math.round(track.bpm) || "—"}</span>
                                            {prev && delta !== 0 && (
                                                <span
                                                    className={`font-mono text-[10px] ${
                                                        Math.abs(delta) > 6
                                                            ? "text-amber-400/70"
                                                            : "text-faint"
                                                    }`}
                                                >
                                                    {delta > 0 ? `+${delta}` : delta}
                                                </span>
                                            )}
                                            {prev && delta === 0 && (
                                                <span className="font-mono text-[10px] text-faint">·</span>
                                            )}
                                        </div>

                                        <div className="hidden sm:flex items-center justify-end">
                                            <div className="w-14 h-1 bg-surface-2 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-accent/50 to-accent"
                                                    style={{ width: `${Math.min(100, (track.energy || 0.5) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

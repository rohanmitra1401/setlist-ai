"use client";
import Script from "next/script";
import { useState } from "react";
import { fetchPlaylistTracksAction, createPlaylistAction } from "@/app/actions";
import { generateSetlist, TrackWithFeatures } from "@/lib/setlist-logic";
import { signIn, signOut, useSession } from "next-auth/react";
import { useAudioAnalysis } from "@/hooks/use-audio-analysis";

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

    const handleExportSpotify = async () => {
        if (!setlist) return;
        setExportLoading(true);
        try {
            const trackUris = setlist.map(t => t.uri);
            const name = `Setlist AI - ${new Date().toLocaleDateString()}`;
            const result = await createPlaylistAction(name, trackUris);

            if (result.success && result.url) {
                setExportUrl(result.url);
                alert("Playlist created successfully!");
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
            `${i + 1}. ${t.name} - ${t.artist} [${t.bpm} BPM] [${t.camelot}]`
        ).join("\n");
        downloadFile(textContent, "setlist.txt", "text/plain");
    };


    // Hybrid Analysis Hook
    const { startAnalysis, status: analysisStatus, progress, currentTrackName } = useAudioAnalysis();

    const handleGenerate = async () => {
        if (!url) {
            setError("Please enter a Spotify Playlist URL");
            return;
        }

        const isMock = url.includes("test") || url.includes("mock");
        if (!session && !isMock) {
            setError("Please log in with Spotify to use real playlists.");
            return;
        }

        setIsLoading(true);
        setError(null);
        setSetlist(null);

        try {
            // 1. Fetch Tracks (Server Side)
            // We only need the token if the server action doesn't get it from session, 
            // but our updated action handles session lookup.
            const tracks = await fetchPlaylistTracksAction(url);

            if (tracks.length === 0) {
                setError("No compatible tracks found or playlist is empty.");
                setIsLoading(false);
                return;
            }

            // Calculate estimated time (avg ~2 seconds per track with concurrency)
            const estimatedMinutes = Math.ceil(tracks.length * 2 / 60);
            const estimatedSeconds = tracks.length * 2 % 60;
            const timeEstimate = estimatedMinutes > 0
                ? `~${estimatedMinutes}m ${estimatedSeconds}s`
                : `~${estimatedSeconds}s`;

            console.log(`[Dashboard] Starting analysis of ${tracks.length} tracks. Estimated time: ${timeEstimate}`);

            // 2. Client Side Analysis (iTunes + Essentia)
            // This runs in the browser
            const analyzedTracks = await startAnalysis(tracks);

            if (!analyzedTracks || analyzedTracks.length === 0) {
                setError("Analysis failed. Could not analyze tracks.");
                setIsLoading(false);
                return;
            }

            // 3. Logic (Client Side)
            const result = generateSetlist(analyzedTracks, {
                targetBpm: bpm,
                startVibe: vibe,
            });

            if (result.length === 0) {
                setError("No compatible tracks found based on your vibe/BPM.");
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

    return (
        <div className="w-full max-w-4xl mx-auto space-y-10">
            {/* Load Essentia Dependencies */}
            <Script src="/essentia/essentia-wasm.web.js" strategy="afterInteractive" />
            <Script src="/essentia/essentia.js-core.js" strategy="afterInteractive" />

            {/* Auth State Header */}
            <div className="flex justify-end">
                {!session ? (
                    <button
                        onClick={() => signIn("spotify")}
                        className="px-6 py-2 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-sm transition-all flex items-center gap-2"
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                        Log in with Spotify
                    </button>
                ) : (
                    <div className="flex items-center gap-4 bg-black/40 px-4 py-2 rounded-full border border-white/10">
                        {session?.user?.image ? (
                            <img src={session.user.image} alt="User" className="w-8 h-8 rounded-full" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold">
                                {session?.user?.name?.[0] || "U"}
                            </div>
                        )}
                        <span className="text-sm font-medium hidden sm:inline">{session?.user?.name}</span>
                        <button
                            onClick={() => signOut()}
                            className="ml-2 text-xs text-muted-foreground hover:text-white transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </div>

            {/* Input Section */}
            <div className="flex flex-col gap-6 p-6 md:p-8 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl shadow-2xl">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground ml-1">Spotify Playlist URL</label>
                    <input
                        type="text"
                        placeholder="paste your playlist link here..."
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground ml-1">Target BPM</label>
                        <div className="relative">
                            <input
                                type="number"
                                value={bpm}
                                onChange={(e) => setBpm(Number(e.target.value))}
                                className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            />
                            <span className="absolute right-4 top-3.5 text-sm text-white/30 pointer-events-none">BPM</span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground ml-1">Vibe</label>
                        <select
                            value={vibe}
                            onChange={(e) => setVibe(e.target.value as any)}
                            className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
                        >
                            <option value="low">Chill (Low Energy)</option>
                            <option value="medium">Balanced (Medium Energy)</option>
                            <option value="high">Peak Hour (High Energy)</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={handleGenerate}
                    disabled={isLoading || analysisStatus === 'analyzing'}
                    className="mt-2 w-full bg-white text-black font-bold text-lg py-4 rounded-xl hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center gap-2">
                            <span className="flex items-center gap-2">
                                <span className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                                {analysisStatus === 'analyzing'
                                    ? `Analyzing: ${currentTrackName} (${progress}%)`
                                    : "Preparing Setlist..."}
                            </span>
                            {/* Progress Bar */}
                            {analysisStatus === 'analyzing' && (
                                <div className="w-full h-1 bg-black/10 rounded-full mt-2 overflow-hidden">
                                    <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
                                </div>
                            )}
                        </div>
                    ) : (
                        "Generate Setlist"
                    )}
                </button>

                {error && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-center">
                        {error}
                    </div>
                )}
            </div>

            {/* Results Section */}
            {setlist && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="flex items-center justify-between px-2">
                        <h2 className="text-2xl font-bold tracking-tight">Your Setlist</h2>
                        <div className="flex items-center gap-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={handleDownloadCSV}
                                    className="text-xs border border-white/20 hover:bg-white/10 text-white px-3 py-2 rounded-full transition"
                                >
                                    CSV
                                </button>
                                <button
                                    onClick={handleDownloadText}
                                    className="text-xs border border-white/20 hover:bg-white/10 text-white px-3 py-2 rounded-full transition"
                                >
                                    TXT
                                </button>
                                {exportUrl ? (
                                    <a
                                        href={exportUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs bg-[#1DB954] text-white px-4 py-2 rounded-full hover:bg-opacity-90 transition font-medium"
                                    >
                                        Open in Spotify
                                    </a>
                                ) : (
                                    <button
                                        onClick={handleExportSpotify}
                                        disabled={exportLoading}
                                        className="text-xs bg-white text-black px-4 py-2 rounded-full hover:bg-white/80 transition font-medium disabled:opacity-50"
                                    >
                                        {exportLoading ? "Saving..." : "Save to Spotify"}
                                    </button>
                                )}
                            </div>
                            <span className="text-sm text-muted-foreground bg-white/5 px-3 py-1 rounded-full border border-white/5">{setlist.length} Tracks</span>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 overflow-hidden backdrop-blur-sm">
                        <div className="overflow-y-auto max-h-[600px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                            {setlist.length === 0 ? (
                                <div className="p-10 text-center text-muted-foreground">
                                    No compatible tracks found. Try adjusting your BPM or Vibe settings.
                                </div>
                            ) : (
                                <div className="divide-y divide-white/5">
                                    {setlist.map((track, i) => (
                                        <div key={`${track.id}-${i}`} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors group">
                                            <div className="flex-shrink-0 w-8 text-center font-mono text-white/30 text-sm">
                                                {(i + 1).toString().padStart(2, '0')}
                                            </div>

                                            <div className="flex-shrink-0 relative overflow-hidden rounded-md w-12 h-12 bg-white/5">
                                                {track.image ? (
                                                    <img src={track.image} alt={track.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-xs text-white/20">IMG</div>
                                                )}
                                            </div>

                                            <div className="flex-grow min-w-0">
                                                <h3 className="font-medium text-white truncate group-hover:text-blue-400 transition-colors">{track.name}</h3>
                                                <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                                            </div>

                                            <div className="flex items-center gap-6 text-sm text-muted-foreground hidden sm:flex">
                                                <div className="flex flex-col items-end w-16">
                                                    <span className="text-white font-mono">{track.camelot || "-"}</span>
                                                    <span className="text-xs opacity-50">KEY</span>
                                                </div>
                                                <div className="flex flex-col items-end w-16">
                                                    <span className="text-white font-mono">{Math.round(track.bpm)}</span>
                                                    <span className="text-xs opacity-50">BPM</span>
                                                </div>
                                                <div className="flex flex-col items-end w-16">
                                                    <div className="w-full bg-white/10 rounded-full h-1.5 mt-1">
                                                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, (track.energy || 0.5) * 100)}%` }}></div>
                                                    </div>
                                                    <span className="text-xs opacity-50 mt-1">ENERGY</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

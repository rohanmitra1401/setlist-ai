'use client';

import { useState } from "react";
import { generateSetlistAction, createPlaylistAction } from "@/app/actions";
import { TrackWithFeatures } from "@/lib/setlist-engine";
import { signIn, signOut, useSession } from "next-auth/react";

export default function EnginePage() {
    const { data: session } = useSession();
    const [playlistUrl, setPlaylistUrl] = useState("");
    const [targetBpm, setTargetBpm] = useState("124");
    const [loading, setLoading] = useState(false);
    const [setlist, setSetlist] = useState<TrackWithFeatures[] | null>(null);
    const [error, setError] = useState("");
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

    const handleGenerate = async () => {
        setLoading(true);
        setError("");
        setSetlist(null);

        try {
            const result = await generateSetlistAction(playlistUrl, {
                targetBpm: parseInt(targetBpm),
            });

            if (!result.success) {
                setError(result.error || "Unknown server error");
                return;
            }

            setSetlist(result.data);
            if (result.data.length === 0) {
                setError("Could not generate a valid setlist from this playlist with the given constraints.");
            }
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };

    const [isDevBypass, setIsDevBypass] = useState(false);

    if (!session && !isDevBypass) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white p-8">
                <h1 className="text-4xl font-bold mb-8 tracking-tighter">Setlist Engine</h1>
                <p className="mb-6 text-neutral-400">Please sign in with Spotify to access the engine.</p>
                <button
                    onClick={() => signIn("spotify")}
                    className="bg-[#1DB954] text-white font-medium py-3 px-8 rounded-full hover:bg-opacity-90 transition"
                >
                    Connect Spotify
                </button>
                {process.env.NODE_ENV === 'development' && (
                    <button
                        onClick={() => setIsDevBypass(true)}
                        className="mt-4 text-xs text-neutral-600 hover:text-neutral-400 underline"
                    >
                        [DEV] Bypass Login
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-6 md:p-12">
            <header className="flex justify-between items-center mb-12">
                <h1 className="text-3xl font-bold tracking-tighter">Setlist Engine</h1>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-neutral-400">Logged in as {session?.user?.name || "Simulated User"}</span>
                    <button
                        onClick={() => signOut()}
                        className="text-xs border border-neutral-700 px-3 py-1 rounded hover:bg-neutral-800"
                    >
                        Sign out
                    </button>
                </div>
            </header>

            <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-12">
                {/* Controls */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-neutral-900 p-6 rounded-2xl border border-neutral-800 space-y-4">
                        <label className="block">
                            <span className="text-sm font-medium text-neutral-300">Spotify Playlist URL</span>
                            <input
                                type="text"
                                value={playlistUrl}
                                onChange={(e) => setPlaylistUrl(e.target.value)}
                                placeholder="https://open.spotify.com/playlist/..."
                                className="mt-2 w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neutral-600 transition"
                            />
                        </label>

                        <label className="block">
                            <span className="text-sm font-medium text-neutral-300">Target BPM</span>
                            <input
                                type="number"
                                value={targetBpm}
                                onChange={(e) => setTargetBpm(e.target.value)}
                                className="mt-2 w-full bg-neutral-950 border border-neutral-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-neutral-600 transition"
                            />
                        </label>

                        <button
                            onClick={handleGenerate}
                            disabled={loading || !playlistUrl}
                            className="w-full bg-white text-black font-semibold py-3 rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition mt-4"
                        >
                            {loading ? "Analyzing & Sorting..." : "Generate Setlist"}
                        </button>

                        {error && (
                            <div className="p-3 bg-red-950/30 border border-red-900/50 rounded text-red-400 text-xs">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-neutral-500 p-4">
                        <h4 className="font-bold mb-2 text-neutral-400">How it works</h4>
                        <ul className="space-y-2 list-disc pl-4">
                            <li>Analyzes tracks (up to 100)</li>
                            <li>Selects best 30 fits</li>
                            <li>Sorts via Parabolic Energy Curve</li>
                            <li>Ensures max +/- 5 BPM jumps</li>
                        </ul>
                    </div>
                </div>

                {/* Results */}
                <div className="lg:col-span-2">
                    {!setlist ? (
                        <div className="h-full flex flex-col items-center justify-center text-neutral-600 border border-dashed border-neutral-800 rounded-2xl min-h-[400px]">
                            <p>Enter a playlist to generate your set.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-end mb-4">
                                <h2 className="text-xl font-bold">{setlist.length} Songs Selected</h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleDownloadCSV}
                                        className="text-xs border border-neutral-700 hover:bg-neutral-800 text-white px-3 py-2 rounded-full transition"
                                    >
                                        CSV
                                    </button>
                                    <button
                                        onClick={handleDownloadText}
                                        className="text-xs border border-neutral-700 hover:bg-neutral-800 text-white px-3 py-2 rounded-full transition"
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
                                            className="text-xs bg-white text-black px-4 py-2 rounded-full hover:bg-neutral-200 transition font-medium disabled:opacity-50"
                                        >
                                            {exportLoading ? "Saving..." : "Save to Spotify"}
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                                <div className="grid grid-cols-12 gap-4 p-4 border-b border-neutral-800 text-xs font-bold text-neutral-500 uppercase tracking-wider">
                                    <div className="col-span-1 text-center">#</div>
                                    <div className="col-span-6">Track</div>
                                    <div className="col-span-2 text-center">BPM</div>
                                    <div className="col-span-3 text-center">Energy</div>
                                </div>
                                <div className="divide-y divide-neutral-800">
                                    {setlist.map((track, i) => (
                                        <div key={track.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-neutral-800/50 transition result-row">
                                            <div className="col-span-1 text-center text-neutral-500 font-mono">{i + 1}</div>
                                            <div className="col-span-6 flex items-center gap-3">
                                                {track.image && <img src={track.image} className="w-8 h-8 rounded" alt="" />}
                                                <div className="overflow-hidden">
                                                    <div className="font-medium truncate">{track.name}</div>
                                                    <div className="text-xs text-neutral-400 truncate">{track.artist}</div>
                                                </div>
                                            </div>
                                            <div className="col-span-2 text-center font-mono text-sm text-neutral-300">
                                                {track.bpm}
                                            </div>
                                            <div className="col-span-3 text-center">
                                                <div className="w-full bg-neutral-800 rounded-full h-1.5 mt-1">
                                                    <div
                                                        className="bg-blue-500 h-1.5 rounded-full"
                                                        style={{ width: `${track.energy * 100}%` }}
                                                    ></div>
                                                </div>
                                                <div className="text-[10px] text-neutral-500 mt-1">{Math.round(track.energy * 100)}%</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

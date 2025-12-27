"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { fetchPlaylistTracks } from "@/lib/setlist-engine";
import { generateSetlist, MoodInput, TrackWithFeatures } from "@/lib/setlist-logic";
import SpotifyWebApi from "spotify-web-api-node";

// Initialize Spotify API client
const spotifyApi = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
});

export type SetlistResponse =
    | { success: true; data: TrackWithFeatures[] }
    | { success: false; error: string };

export async function generateSetlistAction(
    playlistUrl: string,
    moodInput: MoodInput
): Promise<SetlistResponse> {
    try {
        console.log(`[Action] Generating setlist for: ${playlistUrl}`);

        const session = await getServerSession(authOptions);

        if (!session || !session.accessToken) {
            console.error("[Action] No session found");
            return { success: false, error: "Unauthorized. Please log in with Spotify." };
        }

        // 1. Fetch Tracks (Basic Info)
        let tracks: TrackWithFeatures[] = [];
        try {
            tracks = await fetchPlaylistTracksAction(playlistUrl, session.accessToken);
        } catch (e: any) {
            console.error("[Action] Fetch tracks failed:", e);
            return { success: false, error: `Failed to fetch playlist: ${e.message}` };
        }

        if (tracks.length === 0) {
            return { success: true, data: [] };
        }

        // 2. Fetch Audio Features (Server-Side)
        console.log(`[Action] Fetching features for ${tracks.length} tracks`);
        const trackIds = tracks.map(t => t.id);
        const chunkSize = 100;
        const featuresMap = new Map<string, any>();

        // Set Access Token for this request scope
        // spotifyApi.setAccessToken(session.accessToken);

        try {
            for (let i = 0; i < trackIds.length; i += chunkSize) {
                const chunk = trackIds.slice(i, i + chunkSize);

                const idsParam = chunk.join(",");
                const response = await fetch(`https://api.spotify.com/v1/audio-features?ids=${idsParam}`, {
                    headers: {
                        Authorization: `Bearer ${session.accessToken}`,
                    },
                    cache: "no-store"
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`[Action] Spotify API Error (${response.status}):`, errorText);
                    // Throw with the actual error text from Spotify
                    throw new Error(`Spotify API ${response.status}: ${errorText}`);
                }

                const data = await response.json();

                if (data && data.audio_features) {
                    data.audio_features.forEach((f: any) => {
                        if (f) {
                            featuresMap.set(f.id, f);
                        }
                    });
                }
            }
        } catch (error: any) {
            console.error("[Action] Error fetching audio features:", error);
            return {
                success: false,
                error: `Spotify Analysis Failed: ${error.message || "Unknown error"}`
            };
        }

        // 3. Merge Features
        const fullTracks: TrackWithFeatures[] = tracks.map(track => {
            const f = featuresMap.get(track.id);
            if (!f) return track; // Should not happen often

            const camelot = convertSpotifyToCamelot(f.key, f.mode);

            return {
                ...track,
                bpm: Math.round(f.tempo),
                energy: f.energy,
                valence: f.valence,
                danceability: f.danceability,
                key: f.key,
                mode: f.mode,
                camelot: camelot
            };
        });

        // 4. Run Logic
        const setlist = generateSetlist(fullTracks, moodInput);
        console.log(`[Action] Generated setlist with ${setlist.length} tracks`);

        return { success: true, data: setlist };

    } catch (err: any) {
        console.error("[Action] Unexpected error:", err);
        return { success: false, error: `Server Error: ${err.message || String(err)}` };
    }
}

// Output: Raw tracks (no features yet)
export async function fetchPlaylistTracksAction(
    playlistUrl: string,
    accessToken?: string // Optional, if we have it client side, or we get it here
) {
    let token = accessToken;
    if (!token) {
        const session = await getServerSession(authOptions);
        if (!session?.accessToken) {
            throw new Error("Unauthorized");
        }
        token = session.accessToken;
    }

    // Extract ID from URL
    let playlistId = "";
    if (playlistUrl.includes("spotify:playlist:")) {
        playlistId = playlistUrl.split(":")?.pop() || "";
    } else {
        try {
            const url = new URL(playlistUrl);
            const parts = url.pathname.split("/");
            playlistId = parts[2] || parts[1];
        } catch (e) {
            playlistId = playlistUrl;
        }
    }

    if (!playlistId) {
        throw new Error("Invalid Playlist URL");
    }

    // Use shared engine fetcher
    return await fetchPlaylistTracks(playlistId, token);
}

// --- Helpers ---

const keyMap = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const camelotMajor = ["8B", "3B", "10B", "5B", "12B", "7B", "2B", "9B", "4B", "11B", "6B", "1B"];
const camelotMinor = ["5A", "12A", "7A", "2A", "9A", "4A", "11A", "6A", "1A", "8A", "3A", "10A"];

function convertSpotifyToCamelot(key: number, mode: number): string {
    if (key < 0 || key > 11) return "Unknown";

    // Mode 1 = Major, 0 = Minor
    if (mode === 1) {
        return camelotMajor[key];
    } else {
        return camelotMinor[key];
    }
}

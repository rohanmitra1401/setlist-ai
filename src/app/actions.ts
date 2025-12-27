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

export async function generateSetlistAction(
    playlistUrl: string,
    moodInput: MoodInput
): Promise<TrackWithFeatures[]> {
    const session = await getServerSession(authOptions);

    if (!session || !session.accessToken) {
        throw new Error("Unauthorized. Please log in with Spotify.");
    }

    // 1. Fetch Tracks (Basic Info)
    let tracks: TrackWithFeatures[] = [];
    try {
        tracks = await fetchPlaylistTracksAction(playlistUrl, session.accessToken);
    } catch (e: any) {
        throw new Error(`Failed to fetch playlist: ${e.message}`);
    }

    if (tracks.length === 0) return [];

    // 2. Fetch Audio Features (Server-Side)
    // Spotify allows fetching up to 100 tracks at a time
    const trackIds = tracks.map(t => t.id);
    const chunkSize = 100;
    const featuresMap = new Map<string, any>();

    // Set Access Token for this request scope
    spotifyApi.setAccessToken(session.accessToken);

    try {
        for (let i = 0; i < trackIds.length; i += chunkSize) {
            const chunk = trackIds.slice(i, i + chunkSize);
            const response = await spotifyApi.getAudioFeaturesForTracks(chunk);

            response.body.audio_features.forEach((f) => {
                if (f) {
                    featuresMap.set(f.id, f);
                }
            });
        }
    } catch (error) {
        console.error("Error fetching audio features:", error);
        throw new Error("Failed to analyze track features.");
    }

    // 3. Merge Features
    const fullTracks: TrackWithFeatures[] = tracks.map(track => {
        const f = featuresMap.get(track.id);
        if (!f) return track; // Should not happen often

        // Spotify Key: 0=C, 1=C#, etc. Mode: 1=Major, 0=Minor.
        // Convert to Camelot
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

    return setlist;
}

// Reuse existing logic from previous action, but strictly as a helper now
async function fetchPlaylistTracksAction(
    playlistUrl: string,
    accessToken: string
) {
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
    return await fetchPlaylistTracks(playlistId, accessToken);
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

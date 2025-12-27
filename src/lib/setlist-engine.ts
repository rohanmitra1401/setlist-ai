import SpotifyWebApi from "spotify-web-api-node";
import { TrackWithFeatures } from "./setlist-logic";

// Re-export types from logic so we don't break existing imports too badly
export type { TrackWithFeatures, MoodInput } from "./setlist-logic";

export async function fetchPlaylistTracks(
    playlistId: string,
    accessToken: string
): Promise<TrackWithFeatures[]> {
    try {
        // 1. Get Playlist Tracks
        const tracksResponse = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(track(id,name,artists,uri,album(images)))`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!tracksResponse.ok) {
            const errorBody = await tracksResponse.text();
            throw new Error(`Spotify API Error (Tracks): ${tracksResponse.status} ${tracksResponse.statusText} - ${errorBody}`);
        }

        const data = await tracksResponse.json();
        const tracks = data.items
            .map((item: any) => item.track)
            .filter((t: any) => t !== null);

        if (tracks.length === 0) return [];

        const validTracks = tracks.filter((t: any) => t.id);

        // 2. Map to Application Model (Initialize Audio Features to 0/Empty)
        // The CLIENT will fill these in via Essential.js
        const mappedTracks: TrackWithFeatures[] = validTracks.map((track: any) => {
            return {
                id: track.id,
                name: track.name,
                artist: track.artists.map((a: any) => a.name).join(", "),
                uri: track.uri,
                image: track.album.images[0]?.url,

                // Audio Features (To be populated by Client)
                bpm: 0,
                energy: 0,
                valence: 0,
                key: 0,
                mode: 1,
                camelot: "Unknown",
                danceability: 0,
                vibeScore: 0,
            };
        });

        return mappedTracks;

    } catch (error: any) {
        console.error("Error fetching playlist tracks: ", error);
        throw new Error(error.message || "Failed to fetch playlist data from Spotify.");
    }
}

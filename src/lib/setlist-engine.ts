import SpotifyWebApi from "spotify-web-api-node";
import { TrackWithFeatures } from "./setlist-logic";

// Re-export types from logic so we don't break existing imports too badly
export type { TrackWithFeatures, MoodInput } from "./setlist-logic";

export async function fetchPlaylistTracks(
    playlistId: string,
    accessToken: string
): Promise<TrackWithFeatures[]> {
    try {
        const allTracks: TrackWithFeatures[] = [];
        let offset = 0;
        const limit = 100;
        let hasMore = true;

        // Paginate through ALL tracks (Spotify max 100 per request)
        while (hasMore) {
            const tracksResponse = await fetch(
                `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(track(id,name,artists,uri,album(images))),total,next`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` }
                }
            );

            if (!tracksResponse.ok) {
                const errorBody = await tracksResponse.text();
                throw new Error(`Spotify API Error (Tracks): ${tracksResponse.status} ${tracksResponse.statusText} - ${errorBody}`);
            }

            const data = await tracksResponse.json();
            const tracks = data.items
                .map((item: any) => item.track)
                .filter((t: any) => t !== null && t.id);

            // Map to Application Model
            const mappedTracks: TrackWithFeatures[] = tracks.map((track: any) => ({
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
            }));

            allTracks.push(...mappedTracks);

            offset += limit;
            hasMore = data.next !== null && allTracks.length < 500; // Cap at 500 to avoid very long analysis
        }

        console.log(`[PlaylistFetch] Fetched ${allTracks.length} tracks from playlist ${playlistId}`);
        return allTracks;

    } catch (error: any) {
        console.error("Error fetching playlist tracks: ", error);
        throw new Error(error.message || "Failed to fetch playlist data from Spotify.");
    }
}


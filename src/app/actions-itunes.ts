"use server";

export interface ItunesResult {
    trackName: string;
    artistName: string;
    previewUrl: string | null;
    artworkUrl100: string;
}

export async function searchItunesPreview(query: string): Promise<ItunesResult | null> {
    try {
        // Search for music tracks
        const params = new URLSearchParams({
            term: query,
            media: "music",
            entity: "song",
            limit: "1"
        });

        const response = await fetch(`https://itunes.apple.com/search?${params.toString()}`);

        if (!response.ok) {
            console.error("iTunes API Error:", response.statusText);
            return null;
        }

        const data = await response.json();
        const result = data.results[0];

        if (!result || !result.previewUrl) {
            return null;
        }

        return {
            trackName: result.trackName,
            artistName: result.artistName,
            previewUrl: result.previewUrl,
            artworkUrl100: result.artworkUrl100
        };

    } catch (error) {
        console.error("Failed to search iTunes:", error);
        return null;
    }
}

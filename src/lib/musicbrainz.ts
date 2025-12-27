
import { MusicBrainzApi } from 'musicbrainz-api';

const mbApi = new MusicBrainzApi({
    appName: 'SetlistAI',
    appVersion: '0.1.0',
    appContactInfo: 'user@example.com' // Replace with real or environment variable if needed
});

export interface MusicBrainzFeatures {
    bpm: number | null;
    key: number | null;
    mode: number | null; // 1 = Major, 0 = Minor
}

// Helper to convert MusicBrainz Key/Mode notation to Spotify integers
// MB often doesn't have explicit Key/Mode in a structured way easily accessible on recordings without deeper lookups.
// For MVP, we will rely on BPM primarily and try to parse tags if they exist.
// NOTE: MusicBrainz API is complex. Getting "Key" and "BPM" is not always direct.
// BPM is often on the recording. Key is harder.
// Actually, acoustid (via other APIs) is better for this, but stick to MB for now as requested.

// Helper to extract integer BPM from tags array
function extractBpmFromTags(tags: any[]): number | null {
    if (!tags) return null;
    for (const tag of tags) {
        // Tag "name" is usually the key, but MB tags are freeform often.
        // Common BPM tag formats: "bpm:128", "128 bpm"
        if (tag.name.includes('bpm')) {
            const match = tag.name.match(/(\d+)/);
            if (match) return parseInt(match[1]);
        }
    }
    return null;
}

export async function getTrackFeatures(artist: string, trackName: string): Promise<MusicBrainzFeatures | null> {
    try {
        // Boost artist match
        const query = `recording:"${trackName}" AND artist:"${artist}"`;
        console.log(`[MusicBrainz] Searching: ${query}`);
        const result = await mbApi.search('recording', { query, limit: 3 });

        if (!result.recordings || result.recordings.length === 0) {
            console.log(`[MusicBrainz] No results for: ${query}`);
            return null;
        }

        // Ideally we iterate to find one with a BPM
        for (const rec of result.recordings) {
            // Check for tags on the recording
            const bpm = extractBpmFromTags((rec as any).tags);
            if (bpm) {
                console.log(`[MusicBrainz] Found BPM ${bpm} for: ${trackName}`);
                return {
                    bpm: bpm,
                    key: null, // Hard to reliably extract Key from MB tags without deeper parsing
                    mode: null
                };
            }
        }

        console.log(`[MusicBrainz] Results found but NO BPM tag for: ${trackName}`);

        return null;
    } catch (e) {
        console.error("MusicBrainz Error:", e);
        return null;
    }
}

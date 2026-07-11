"use server";

export interface ItunesResult {
    trackName: string;
    artistName: string;
    previewUrl: string | null;
    artworkUrl100: string;
}

export interface PreviewResult {
    previewUrl: string | null;
    /** BPM from provider metadata (Deezer). 0 = unknown. */
    knownBpm: number;
    source: "itunes" | "deezer" | null;
    matchedName?: string;
    matchedArtist?: string;
}

// ----------------------------------------------------------------------
// Matching helpers
// ----------------------------------------------------------------------

const normalize = (s: string): string =>
    s
        .toLowerCase()
        .replace(/[’'`´]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/** Fraction of query tokens present in candidate (0-1). */
function tokenOverlap(query: string, candidate: string): number {
    const q = normalize(query).split(" ").filter(Boolean);
    if (q.length === 0) return 0;
    const c = new Set(normalize(candidate).split(" ").filter(Boolean));
    let hits = 0;
    for (const t of q) if (c.has(t)) hits++;
    return hits / q.length;
}

/** Strip remix/version/feat decorations, e.g. "925 - Four Tet Remix" -> "925". */
function cleanTitle(name: string): string {
    return name
        .replace(/\s*[-–—]\s*[^-–—]*(remix|mix|edit|version|rework|bootleg|dub|vip|extended|radio)[^-–—]*$/i, "")
        .replace(/\s*[([][^)\]]*(remix|mix|edit|version|rework|bootleg|dub|vip|extended|feat\.?|ft\.?|with)[^)\]]*[)\]]/gi, "")
        .trim();
}

function primaryArtist(artist: string): string {
    return artist.split(",")[0].trim();
}

function scoreCandidate(
    wantName: string,
    wantArtist: string,
    gotName: string,
    gotArtist: string
): number {
    // Title match matters most; artist confirms it's not a cover/karaoke version.
    const titleScore = Math.max(
        tokenOverlap(wantName, gotName),
        tokenOverlap(gotName, wantName)
    );
    const artistScore = tokenOverlap(primaryArtist(wantArtist), gotArtist);
    return titleScore * 0.7 + artistScore * 0.3;
}

const MATCH_THRESHOLD = 0.6;

// ----------------------------------------------------------------------
// Providers
// ----------------------------------------------------------------------

interface Candidate {
    previewUrl: string;
    name: string;
    artist: string;
    score: number;
    deezerId?: number;
}

async function searchItunes(
    term: string,
    wantName: string,
    wantArtist: string
): Promise<Candidate | null> {
    try {
        const params = new URLSearchParams({
            term,
            media: "music",
            entity: "song",
            limit: "5",
        });
        const response = await fetch(
            `https://itunes.apple.com/search?${params.toString()}`
        );
        if (!response.ok) return null;

        const data = await response.json();
        let best: Candidate | null = null;
        for (const r of data.results || []) {
            if (!r.previewUrl) continue;
            const score = scoreCandidate(wantName, wantArtist, r.trackName, r.artistName);
            if (!best || score > best.score) {
                best = {
                    previewUrl: r.previewUrl,
                    name: r.trackName,
                    artist: r.artistName,
                    score,
                };
            }
        }
        return best && best.score >= MATCH_THRESHOLD ? best : null;
    } catch (error) {
        console.error("iTunes search failed:", error);
        return null;
    }
}

async function searchDeezer(
    term: string,
    wantName: string,
    wantArtist: string
): Promise<Candidate | null> {
    try {
        const response = await fetch(
            `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=5`
        );
        if (!response.ok) return null;

        const data = await response.json();
        let best: Candidate | null = null;
        for (const r of data.data || []) {
            if (!r.preview) continue;
            const score = scoreCandidate(wantName, wantArtist, r.title, r.artist?.name || "");
            if (!best || score > best.score) {
                best = {
                    previewUrl: r.preview,
                    name: r.title,
                    artist: r.artist?.name || "",
                    score,
                    deezerId: r.id,
                };
            }
        }
        return best && best.score >= MATCH_THRESHOLD ? best : null;
    } catch (error) {
        console.error("Deezer search failed:", error);
        return null;
    }
}

/** Deezer track endpoint exposes catalog BPM (0 when unknown). */
async function getDeezerBpm(trackId: number): Promise<number> {
    try {
        const response = await fetch(`https://api.deezer.com/track/${trackId}`);
        if (!response.ok) return 0;
        const data = await response.json();
        return typeof data.bpm === "number" && data.bpm > 40 ? data.bpm : 0;
    } catch {
        return 0;
    }
}

// ----------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------

/**
 * Find a 30s preview for a track, trying:
 * 1. iTunes (full title)   2. Deezer (full title)
 * 3. iTunes (cleaned title) 4. Deezer (cleaned title)
 * Full title first so remixes match the remix, not the original.
 */
export async function findTrackPreview(
    artist: string,
    name: string
): Promise<PreviewResult> {
    const fullQuery = `${primaryArtist(artist)} ${name}`;
    const cleaned = cleanTitle(name);
    const cleanedQuery = `${primaryArtist(artist)} ${cleaned}`;

    const attempts: Array<() => Promise<Candidate | null>> = [
        () => searchItunes(fullQuery, name, artist),
        () => searchDeezer(fullQuery, name, artist),
    ];
    // Only retry with the cleaned title if it actually differs — matching the
    // original instead of the remix is a last resort.
    if (cleaned && cleaned !== name) {
        attempts.push(() => searchItunes(cleanedQuery, cleaned, artist));
        attempts.push(() => searchDeezer(cleanedQuery, cleaned, artist));
    }

    for (const attempt of attempts) {
        const hit = await attempt();
        if (hit) {
            const knownBpm = hit.deezerId ? await getDeezerBpm(hit.deezerId) : 0;
            return {
                previewUrl: hit.previewUrl,
                knownBpm,
                source: hit.deezerId ? "deezer" : "itunes",
                matchedName: hit.name,
                matchedArtist: hit.artist,
            };
        }
    }

    return { previewUrl: null, knownBpm: 0, source: null };
}

/** @deprecated kept for compatibility; use findTrackPreview instead. */
export async function searchItunesPreview(query: string): Promise<ItunesResult | null> {
    try {
        const params = new URLSearchParams({
            term: query,
            media: "music",
            entity: "song",
            limit: "1",
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
            artworkUrl100: result.artworkUrl100,
        };
    } catch (error) {
        console.error("Failed to search iTunes:", error);
        return null;
    }
}

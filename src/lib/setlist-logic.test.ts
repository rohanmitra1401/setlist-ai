import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateSetlist, type TrackWithFeatures } from "@/lib/setlist-logic";

const track = (id: string, bpm: number, camelot = "8A", energy = 0.5, vibeScore = 50): TrackWithFeatures => ({
    id,
    name: `Track ${id}`,
    artist: "Artist",
    uri: `spotify:track:${id}`,
    bpm,
    energy,
    valence: 0.5,
    key: 0,
    mode: 1,
    camelot,
    danceability: 0.5,
    vibeScore,
});

describe("generateSetlist", () => {
    beforeEach(() => {
        // generateSetlist logs debug lines on every call.
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("returns an empty set for an empty playlist", () => {
        expect(generateSetlist([], { targetBpm: 128 })).toEqual([]);
    });

    it("caps the set at 30 tracks with no duplicates", () => {
        const pool = Array.from({ length: 60 }, (_, i) => track(`t${i}`, 120 + (i % 10), "8A", (i % 10) / 10));
        const set = generateSetlist(pool, { targetBpm: 125 });

        expect(set).toHaveLength(30);
        expect(new Set(set.map((t) => t.id)).size).toBe(30);
    });

    it("never repeats a track that appears twice in the playlist", () => {
        const pool = [track("a", 128), track("a", 128), track("b", 128), track("c", 128)];
        const ids = generateSetlist(pool, { targetBpm: 128 }).map((t) => t.id);

        expect(new Set(ids).size).toBe(ids.length);
    });

    it("treats half- and double-time tracks as matches for the target BPM", () => {
        const pool = [track("perfect", 140), track("half", 70), track("double", 280), track("off", 100)];
        const set = generateSetlist(pool, { targetBpm: 140 });

        expect(set.slice(0, 3).map((t) => t.id).sort()).toEqual(["double", "half", "perfect"]);
        expect(set.at(-1)?.id).toBe("off");
    });
});

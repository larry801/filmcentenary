import {fetchFullLog, getMatch, MissingServerLogError} from "./match";

const mockFetch = (response: Response) => {
    const fn = jest.fn().mockResolvedValue(response);
    global.fetch = fn as unknown as typeof fetch;
    return fn;
};

describe("fetchFullLog", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("returns the parsed body for a JSON log", async () => {
        const log = {gameName: "virginQueen", matchID: "m1", log: []};
        mockFetch(new Response(JSON.stringify(log), {
            status: 200,
            headers: {"Content-Type": "application/json; charset=utf-8"},
        }));

        await expect(fetchFullLog("http://server", "virginQueen", "m1")).resolves.toEqual(log);
    });

    it("reports a missing server log when a static host returns index.html", async () => {
        mockFetch(new Response("<!DOCTYPE html><html></html>", {
            status: 200,
            headers: {"Content-Type": "text/html; charset=utf-8"},
        }));

        await expect(fetchFullLog("http://static", "virginQueen", "local")).rejects.toBeInstanceOf(MissingServerLogError);
    });

    it("reports a missing server log for an unknown match", async () => {
        mockFetch(new Response("Match local not found", {status: 404}));

        await expect(fetchFullLog("http://server", "virginQueen", "local")).rejects.toBeInstanceOf(MissingServerLogError);
    });

    it("keeps the server error for a match that has not ended", async () => {
        mockFetch(new Response("Match m1 has not ended", {status: 403}));

        await expect(fetchFullLog("http://server", "virginQueen", "m1")).rejects.toThrow(
            "failed to export log: Match m1 has not ended"
        );
    });
});

describe("getMatch", () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("keeps the game's setupData so a lobby can read the bot seats", async () => {
        mockFetch(new Response(JSON.stringify({
            matchID: "m1",
            players: [{id: 0, name: "P1"}, {id: 1}, {id: 2, name: "Bot FR"}],
            setupData: {bots: ["FR"]},
        }), {status: 200, headers: {"Content-Type": "application/json"}}));

        const match = await getMatch("http://server", "m1", "imperialElegy");
        expect(match.matchID).toBe("m1");
        expect(match.players.get("1" as never)).toBeNull();
        expect(match.players.get("2" as never)).toBe("Bot FR");
        expect(match.setupData).toEqual({bots: ["FR"]});
    });

    it("leaves setupData absent when the server did not keep it", async () => {
        mockFetch(new Response(JSON.stringify({
            matchID: "m2",
            players: [{id: 0, name: "P1"}, {id: 1}],
        }), {status: 200, headers: {"Content-Type": "application/json"}}));

        const match = await getMatch("http://server", "m2", "film");
        expect(match.setupData).toBeUndefined();
    });
});

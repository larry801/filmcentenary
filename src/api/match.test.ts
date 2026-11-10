import {fetchFullLog, MissingServerLogError} from "./match";

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

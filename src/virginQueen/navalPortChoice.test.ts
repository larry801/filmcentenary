import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {SPACE_BY_ID, SPACES} from "./mapData";
import {arriveLeaders, homePortsFor, setupGame} from "./util";
import {chooseNavalLeaderPort, endPhaseTurn} from "./moves";

const context = (player = "0", phase = "spring"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase,
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context("0", "action"), phase: "action"} as Ctx);

/** Uluch Ali starts in the pool, so a return can be staged without touching the map. */
const returnUluchAli = (G: VQGame): void => {
    G.leaders.uluchAli = {id: "uluchAli", location: "pool", returnTurn: G.year};
};

describe("naval leader home-port choice", () => {
    it("records a pending choice instead of placing the leader immediately", () => {
        const G = game();
        returnUluchAli(G);

        arriveLeaders(G, {interactive: true});

        expect(G.navalLeaderArrivals?.find((entry) => entry.leader === "uluchAli"))
            .toEqual({leader: "uluchAli", power: "ottoman", ports: homePortsFor(G, "ottoman")});
        expect(G.leaders.uluchAli.location).toBe("pool");
        expect(G.spaces.athens.leaders).not.toContain("uluchAli");
    });

    it("honours the chosen home port and clears the pending choice", () => {
        const G = game();
        returnUluchAli(G);
        arriveLeaders(G, {interactive: true});
        const endStage = jest.fn();

        expect(chooseNavalLeaderPort(G, {...context("0"), events: {endStage}} as unknown as Ctx,
            {leader: "uluchAli", port: "athens"})).toBeUndefined();

        expect(G.leaders.uluchAli).toEqual({id: "uluchAli", location: "athens"});
        expect(G.spaces.athens.leaders).toContain("uluchAli");
        expect((G.navalLeaderArrivals ?? []).some((entry) => entry.leader === "uluchAli")).toBe(false);
        // No other Ottoman naval leader is waiting, so the choice stage closes.
        expect(endStage).toHaveBeenCalledTimes(1);
    });

    it("rejects a port that is not a legal Ottoman home port", () => {
        const G = game();
        returnUluchAli(G);
        arriveLeaders(G, {interactive: true});

        expect(chooseNavalLeaderPort(G, context("0"), {leader: "uluchAli", port: "london"})).toBe(INVALID_MOVE);

        expect(G.leaders.uluchAli.location).toBe("pool");
        expect((G.navalLeaderArrivals ?? []).some((entry) => entry.leader === "uluchAli")).toBe(true);
    });

    it("leaves the leader in the pool when no home port is legal", () => {
        const G = game();
        returnUluchAli(G);
        for (const space of SPACES.filter((candidate) => candidate.home === "ottoman")) {
            G.spaces[space.id].unrest = true;
        }

        arriveLeaders(G, {interactive: true});

        expect((G.navalLeaderArrivals ?? []).some((entry) => entry.power === "ottoman")).toBe(false);
        expect(G.leaders.uluchAli.location).toBe("pool");
    });

    it("auto-places for callers that do not request a choice", () => {
        const G = game();
        returnUluchAli(G);

        arriveLeaders(G);

        expect(G.navalLeaderArrivals).toBeUndefined();
        expect(G.leaders.uluchAli.location).not.toBe("pool");
        expect(SPACE_BY_ID[G.leaders.uluchAli.location].ports).toBeDefined();
        expect(G.spaces[G.leaders.uluchAli.location].leaders).toContain("uluchAli");
    });

    it("falls back to the first legal port if the spring turn is ended without a choice", () => {
        const G = game();
        returnUluchAli(G);
        arriveLeaders(G, {interactive: true});
        const expected = homePortsFor(G, "ottoman")[0];

        expect(endPhaseTurn(G, context("0"))).toBeUndefined();

        expect(G.leaders.uluchAli).toEqual({id: "uluchAli", location: expected});
        expect((G.navalLeaderArrivals ?? []).some((entry) => entry.leader === "uluchAli")).toBe(false);
    });
});

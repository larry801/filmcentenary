import {Ctx} from "boardgame.io";
import {LEADER_BY_ID, leaderName} from "./constant/leaders";
import {OFFICIAL_LEADERS} from "./data/leaders";
import {setupGame} from "./util";

const ctx = {
    currentPlayer: "0",
    playerID: "0",
    phase: "spring",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx;

describe("John Norreys", () => {
    it("is an English army leader with his printed ratings", () => {
        expect(LEADER_BY_ID.norreys).toMatchObject({power: "england", kind: "army", battle: 1, command: 6});
        expect(leaderName("norreys", "en")).toBe("John Norreys");
        expect(leaderName("norreys")).toBe("约翰·诺里斯");
    });

    it("is on the Leader Entry Table for turn 4", () => {
        expect(OFFICIAL_LEADERS.find((leader) => leader.id === "norreys")?.entryTurn).toBe(4);
    });

    it("exists in the Campaign but starts off the map", () => {
        const G = setupGame(ctx, {scenario: "campaign"} as never);
        expect(G.leaders.norreys).toBeDefined();
        expect(G.spaces[G.leaders.norreys.location]).toBeUndefined();
    });
});

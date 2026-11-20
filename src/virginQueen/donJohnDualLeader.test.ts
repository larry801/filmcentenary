import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {LEADER_BY_ID, leaderIsArmy, leaderIsNaval} from "./constant/leaders";
import {bestBattle, setupGame} from "./util";

/**
 * Rule 10 step 4: "Don John is placed as either an army leader or a naval
 * leader.  He may switch leader type at any time during a Spanish impulse if he
 * occupies a port space under friendly control."  Rule 20.4 adds that in the
 * Winter Phase he "also has the option to switch into an Army Leader", and
 * 19.3 exempts him from assassination "while serving as a naval leader".
 */
const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

describe("Don John as a dual leader (rules 10.4/20.4)", () => {
    it("is classified as both an army and a naval leader", () => {
        expect(LEADER_BY_ID.donJohn.kind).toBe("both");
        expect(leaderIsArmy("donJohn")).toBe(true);
        expect(leaderIsNaval("donJohn")).toBe(true);
        // A plain army or naval leader is not both.
        expect(leaderIsNaval("alba")).toBe(false);
        expect(leaderIsArmy("santaCruz")).toBe(false);
    });

    it("lends his Battle Rating to a naval battle", () => {
        const G = game();
        G.year = 2;
        G.seaZones.englishChannel.naval.spain = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
        G.seaZones.englishChannel.leaders = ["donJohn"];
        G.leaders.donJohn = {id: "donJohn", location: "englishChannel"};

        expect(bestBattle(G, "englishChannel", ["spain"], "naval")).toBe(1);
    });

    it("still leads an army", () => {
        const G = game();
        G.spaces.madrid.leaders = ["donJohn"];
        G.leaders.donJohn = {id: "donJohn", location: "madrid"};

        expect(bestBattle(G, "madrid", ["spain"], "army")).toBe(1);
    });
});

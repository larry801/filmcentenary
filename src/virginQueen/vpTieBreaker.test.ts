import {Ctx} from "boardgame.io";
import {POWER_INFO, POWERS, VQGame} from "./constant/general";
import {KEY_SPACES} from "./mapData";
import {breakVpTie, checkImmediateVictory, checkVictory, powerVp, setupGame} from "./util";

const context = (): Ctx => ({
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const setScore = (G: VQGame, power: typeof POWERS[number], score: number): void => {
    G.powers[power].bonusVp += score - powerVp(G, power);
};

/** A game sitting in Victory Determination after Winter of turn 4. */
const scoringGame = (): VQGame => {
    const G = setupGame(context());
    G.year = 5;
    G.checkVictory = true;
    for (const power of POWERS) setScore(G, power, 10);
    return G;
};

describe("VP tie-breaker (25.3)", () => {
    it("narrows the tied group as it steps back through earlier turns", () => {
        const G = scoringGame();
        setScore(G, "spain", 26);
        setScore(G, "france", 26);
        setScore(G, "england", 26);
        // Turn 3: Spain and France tie ahead of England; turn 2: England led,
        // but England was already eliminated, so France wins.
        G.vpHistory["3"] = {spain: 18, france: 18, england: 15};
        G.vpHistory["2"] = {spain: 10, france: 12, england: 20};
        expect(checkVictory(G)).toEqual({winner: "france", reason: "standard"});
    });

    it("starts from the turn before the one just completed", () => {
        const G = scoringGame();
        setScore(G, "spain", 26);
        setScore(G, "france", 26);
        G.vpHistory["4"] = {spain: 26, france: 26};
        G.vpHistory["3"] = {spain: 17, france: 19};
        expect(checkVictory(G)).toEqual({winner: "france", reason: "standard"});
    });

    it("breaks Time Limit ties the same way", () => {
        const G = scoringGame();
        G.year = G.endTurn + 1;
        setScore(G, "spain", 20);
        setScore(G, "england", 20);
        G.vpHistory[String(G.endTurn - 1)] = {spain: 15, england: 16};
        expect(checkVictory(G)).toEqual({winner: "england", reason: "timeLimit"});
    });

    it("skips turns with no record and falls back to the first tied power", () => {
        const G = scoringGame();
        G.vpHistory["2"] = {spain: 5, france: 5};
        expect(breakVpTie(G, ["spain", "france"], 3)).toBe("spain");
        G.vpHistory["1"] = {spain: 4, france: 6};
        expect(breakVpTie(G, ["spain", "france"], 3)).toBe("france");
    });
});

describe("simultaneous automatic victories (25.1)", () => {
    const giveMilitaryVictory = (G: VQGame, power: typeof POWERS[number]): void => {
        for (const id of KEY_SPACES.slice(0, POWER_INFO[power].autoWinKeys)) {
            G.spaces[id].control = power;
            G.spaces[id].unrest = false;
        }
        G.militaryVictoryBaseline[power] = 0;
    };

    it("awards the win to the power with more VP", () => {
        const G = scoringGame();
        G.year = 3;
        G.espionage = {...G.espionage, catholicRebellionVictory: true} as VQGame["espionage"];
        giveMilitaryVictory(G, "ottoman");
        setScore(G, "spain", 12);
        setScore(G, "ottoman", 15);
        expect(checkImmediateVictory(G, "action")).toEqual({winner: "ottoman", reason: "military"});
        setScore(G, "spain", 16);
        expect(checkImmediateVictory(G, "action")).toEqual({winner: "spain", reason: "catholicRebellion"});
    });

    it("uses the last completed turn's score when VP are tied", () => {
        const G = scoringGame();
        G.year = 3;
        G.espionage = {...G.espionage, catholicRebellionVictory: true} as VQGame["espionage"];
        giveMilitaryVictory(G, "ottoman");
        setScore(G, "spain", 14);
        setScore(G, "ottoman", 14);
        G.vpHistory["2"] = {spain: 9, ottoman: 11};
        expect(checkImmediateVictory(G, "action")).toEqual({winner: "ottoman", reason: "military"});
    });
});

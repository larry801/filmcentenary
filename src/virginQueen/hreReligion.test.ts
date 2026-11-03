import {Ctx} from "boardgame.io";
import {Client} from "boardgame.io/client";
import {INVALID_MOVE} from "boardgame.io/core";
import {Local} from "boardgame.io/multiplayer";
import {HreReligiousPreference, POWERS, VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {chooseHomeCard, chooseHreReligiousPreference, endPhaseTurn} from "./moves";
import {checkVictory, dealYear, homeCardChoiceRequired, homeCardsInHand, hreReligiousPreferenceRequired,
    hreReligiousVp, powerVp, setupGame, winter} from "./util";

const context = (extra: Partial<Ctx> = {}): Ctx => ({
    random: {Die: () => 6, Shuffle: (cards: unknown[]) => cards},
    ...extra,
} as unknown as Ctx);

const spring = (): Ctx => context({phase: "spring", currentPlayer: "4"});

const setScore = (G: VQGame, power: typeof POWERS[number], score: number): void => {
    G.powers[power].bonusVp += score - powerVp(G, power);
};

const scoringGame = (): VQGame => {
    const G = setupGame(context());
    G.year = 4;
    G.hreReligiousPreference = "catholic";
    G.hreReligiousPreferenceChosen = true;
    G.royals.find((royal) => royal.id === "elizabeth")!.married = true;
    for (const power of POWERS) setScore(G, power, 18);
    return G;
};

describe("HRE secret religious preference", () => {
    it.each(["campaign", "tournament"] as const)("requires one secret choice in the first Spring of %s", (scenario) => {
        const G = setupGame(context(), {scenario});
        dealYear(G, context());
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(true);
        expect(chooseHomeCard(G, spring(), {cardId: homeCardsInHand(G, "hre")[0]})).toBeUndefined();
        expect(endPhaseTurn(G, spring())).toBe(INVALID_MOVE);
        expect(chooseHreReligiousPreference(G, spring(), {preference: "balanced"})).toBeUndefined();
        expect(endPhaseTurn(G, spring())).toBeUndefined();
        expect(chooseHreReligiousPreference(G, spring(), {preference: "catholic"})).toBe(INVALID_MOVE);
        G.year++;
        dealYear(G, context());
        expect(G.hreReligiousPreference).toBe("balanced");
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(false);
    });

    it("rejects invalid choices, phases, powers and later turns without changes", () => {
        const G = setupGame(context());
        const before = JSON.stringify(G);
        for (const ctx of [context({phase: "diplomacy", currentPlayer: "4"}), context({phase: "spring", currentPlayer: "1"})]) {
            expect(chooseHreReligiousPreference(G, ctx, {preference: "balanced"})).toBe(INVALID_MOVE);
        }
        expect(chooseHreReligiousPreference(G, spring(), {preference: "toString" as HreReligiousPreference})).toBe(INVALID_MOVE);
        expect(JSON.stringify(G)).toBe(before);
        G.year++;
        expect(chooseHreReligiousPreference(G, spring(), {preference: "balanced"})).toBe(INVALID_MOVE);
    });

    it.each(["campaign", "tournament", "tutorial"] as const)("disables preference and its VP for two-player %s", (scenario) => {
        const G = setupGame(context({numPlayers: 2}), {scenario});
        G.hreReligiousPreference = "catholic";
        G.hreReligiousPreferenceRevealed = true;
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(false);
        expect(hreReligiousVp(G)).toBe(0);
        expect(chooseHreReligiousPreference(G, spring(), {preference: "balanced"})).toBe(INVALID_MOVE);
    });

    it.each([
        [10, 14, 0, 0, 7], [15, 19, 0, 0, 5], [20, 24, 0, 2, 3], [25, 29, 0, 4, 1],
        [30, 34, 1, 4, 0], [35, 39, 3, 2, 0], [40, 44, 5, 0, 0], [45, 49, 7, 0, 0],
    ])("uses the printed VP row for %i–%i Protestant spaces", (first, last, protestant, balanced, catholic) => {
        const G = setupGame(context());
        for (const count of [first, last]) {
            G.protestantSpacesStart = count;
            for (const [preference, expected] of Object.entries({protestant, balanced, catholic})) {
                G.hreReligiousPreference = preference as HreReligiousPreference;
                expect(hreReligiousVp(G)).toBe(expected);
            }
        }
    });

    it("excludes unrevealed VP from public totals and historical tie-breakers", () => {
        const G = scoringGame();
        setScore(G, "hre", 15);
        expect(hreReligiousVp(G)).toBe(5);
        expect(powerVp(G, "hre")).toBe(15);
        winter(G, context());
        expect(G.hreReligiousPreferenceRevealed).toBe(false);
        expect(G.vpHistory["4"].hre).toBe(15);
        expect(checkVictory(G)).toBeUndefined();
    });

    it("reveals to win at 25 VP and keeps the calculation pure", () => {
        const G = scoringGame();
        setScore(G, "hre", 21);
        const before = JSON.stringify(G);
        expect(checkVictory(G)).toBeUndefined();
        expect(JSON.stringify(G)).toBe(before);
        winter(G, context());
        expect(G.hreReligiousPreferenceRevealed).toBe(true);
        expect(powerVp(G, "hre")).toBe(26);
        expect(checkVictory(G)).toEqual({winner: "hre", reason: "standard"});
    });

    it("reveals to prevent domination and includes public VP in this and later years", () => {
        const G = scoringGame();
        setScore(G, "spain", 23);
        setScore(G, "hre", 15);
        winter(G, context());
        expect(G.hreReligiousPreferenceRevealed).toBe(true);
        expect(G.vpHistory["4"].hre).toBe(20);
        expect(checkVictory(G)).toBeUndefined();
        G.protestantSpacesStart = 20;
        expect(hreReligiousVp(G)).toBe(3);
        expect(powerVp(G, "hre")).toBe(18);
        winter(G, context());
        expect(G.vpHistory["5"].hre).toBe(18);
    });

    it("keeps the choice secret if its VP cannot stop another winner", () => {
        const G = scoringGame();
        setScore(G, "spain", 30);
        winter(G, context());
        expect(G.hreReligiousPreferenceRevealed).toBe(false);
        expect(checkVictory(G)?.winner).toBe("spain");
    });

    it("only considers domination from the end of turn four", () => {
        const G = scoringGame();
        G.year = 3;
        setScore(G, "spain", 23);
        setScore(G, "hre", 15);
        winter(G, context());
        expect(G.hreReligiousPreferenceRevealed).toBe(false);
        expect(checkVictory(G)).toBeUndefined();
        winter(G, context());
        expect(G.hreReligiousPreferenceRevealed).toBe(true);
        expect(checkVictory(G)).toBeUndefined();
    });

    it("does not reveal when a historical tie-breaker still awards the win to another power", () => {
        const G = scoringGame();
        setScore(G, "spain", 26);
        setScore(G, "hre", 21);
        G.vpHistory["3"] = {spain: 20, hre: 19};
        winter(G, context());
        expect(G.hreReligiousPreferenceRevealed).toBe(false);
        expect(G.vpHistory["4"].hre).toBe(21);
        expect(checkVictory(G)).toEqual({winner: "spain", reason: "standard"});
    });

    it("uses earlier public scores to decide whether a tied HRE can reveal and win", () => {
        const G = scoringGame();
        setScore(G, "spain", 26);
        setScore(G, "hre", 21);
        G.vpHistory["3"] = {spain: 19, hre: 20};
        winter(G, context());
        expect(G.hreReligiousPreferenceRevealed).toBe(true);
        expect(checkVictory(G)).toEqual({winner: "hre", reason: "standard"});
    });

    it("reveals to win at the scenario time limit", () => {
        const G = scoringGame();
        G.year = G.endTurn;
        setScore(G, "spain", 21);
        setScore(G, "hre", 18);
        winter(G, context());
        expect(G.hreReligiousPreferenceRevealed).toBe(true);
        expect(checkVictory(G)).toEqual({winner: "hre", reason: "timeLimit"});
    });

    it("redacts move arguments and player views until public revelation", () => {
        const multiplayer = Local();
        const game = {...VirginQueenGameDef, seed: "hre-preference"};
        const clients = POWERS.map((_, index) => {
            const client = Client({game, numPlayers: 6, playerID: String(index), multiplayer});
            client.start();
            return client;
        });
        try {
            for (let phase = 0; phase < 2; phase++) clients.forEach((client) => client.moves.endPhaseTurn());
            for (let index = 0; index < 4; index++) {
                const G = clients[index].getState()!.G;
                if (homeCardChoiceRequired(G, POWERS[index])) clients[index].moves.chooseHomeCard({cardId: homeCardsInHand(G, POWERS[index])[0]});
                clients[index].moves.endPhaseTurn();
            }
            clients[4].moves.chooseHreReligiousPreference({preference: "catholic"});
            const own = clients[4].getState()!.G;
            const opponent = clients[1].getState()!;
            expect(own.hreReligiousPreference).toBe("catholic");
            expect(opponent.G.hreReligiousPreference).toBeUndefined();
            expect(opponent.G.hreReligiousPreferenceChosen).toBe(true);
            expect(opponent.G.log.at(-1)).toBe("Holy Roman records its secret religious preference.");
            expect(opponent.log.at(-1)!.action.payload.args).toBeNull();
            const view = VirginQueenGameDef.playerView! as (G: VQGame, ctx: Ctx, playerID: string | null) => VQGame;
            expect(view(own, spring(), null).hreReligiousPreference).toBeUndefined();
            own.hreReligiousPreferenceRevealed = true;
            expect(view(own, spring(), null).hreReligiousPreference).toBe("catholic");
        } finally {
            clients.forEach((client) => client.stop());
        }
    });
});

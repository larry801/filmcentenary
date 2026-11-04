import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {VQGame} from "./constant/general";
import {VirginQueenGameDef} from "./game";
import {chooseHreReligiousPreference, endPhaseTurn} from "./moves";
import {
    activateMajor,
    hreReligiousPreferenceEnabled,
    hreReligiousPreferenceRequired,
    hreReligiousVp,
    powerVp,
    setupGame,
} from "./util";

/**
 * Official rule: the HRE secret religious preference is a six-player rule.
 * - Rules Manual (2024 Living), Spring Deployment step 3: "If this is the first
 *   turn of a 6-player game, the Holy Roman player must record their secret
 *   Religious Preference."
 * - Scenario Book (2024 Living) p. 13, Activated Major Powers, Additional
 *   Considerations: "Players should skip having the Holy Roman player choose a
 *   secret religious preference (and gain VP from such a choice) in the 2 to
 *   5-player games."
 *
 * Activating the non-player HRE in a 2-5 player game gives the ally control of
 * a full power, but the six-player-only preference stays off: no choice, no
 * preference VP, no winter revelation.  Six-player games are unchanged.
 */
const context = (numPlayers = 6, extra: Partial<Ctx> = {}): Ctx => ({
    numPlayers,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
    ...extra,
} as unknown as Ctx);

const spring = (numPlayers = 6, playerID = "4"): Ctx =>
    context(numPlayers, {phase: "spring", currentPlayer: playerID});

const game = (numPlayers = 6, scenario: "campaign" | "tournament" = "campaign"): VQGame =>
    setupGame(context(numPlayers), {scenario});

/** Activate the non-player HRE under England's control without a card event. */
const activateHre = (G: VQGame, numPlayers = 5): void => {
    expect(activateMajor(G, context(numPlayers), "hre", "england")).toBe(true);
    G.activePower = "hre";
};

describe("HRE secret religious preference rule", () => {
    it.each([2, 3, 4, 5] as const)(
        "skips the preference in %i-player games even after the HRE is activated",
        (numPlayers) => {
            const G = game(numPlayers);
            expect(hreReligiousPreferenceEnabled(G)).toBe(false);
            expect(hreReligiousPreferenceRequired(G, "hre")).toBe(false);

            activateHre(G, numPlayers);
            expect(G.activatedMajors!.hre).toEqual({ally: "england", baseline: expect.any(Number)});
            const vpBefore = powerVp(G, "hre");
            expect(hreReligiousPreferenceEnabled(G)).toBe(false);
            expect(hreReligiousPreferenceRequired(G, "hre")).toBe(false);
            expect(chooseHreReligiousPreference(G, spring(numPlayers), {preference: "catholic"}))
                .toBe(INVALID_MOVE);

            // Even a preference forced into the state earns nothing: the rule
            // removes both the choice and the VP derived from it.
            G.hreReligiousPreference = "catholic";
            G.hreReligiousPreferenceChosen = true;
            G.hreReligiousPreferenceRevealed = true;
            G.protestantSpacesStart = 20;
            expect(hreReligiousVp(G)).toBe(0);
            expect(powerVp(G, "hre")).toBe(vpBefore);
        });

    it("does not block an activated five-player HRE's Spring turn", () => {
        const G = game(5);
        activateHre(G);
        expect(endPhaseTurn(G, spring(5))).toBeUndefined();
        expect(G.hreReligiousPreferenceChosen).toBe(false);
        expect(G.hreReligiousPreference).toBeUndefined();
    });

    it("keeps the five-player HRE's Papacy/Venice/Ireland markers separate from this rule", () => {
        // Scenario Book p. 12 sets these markers aside until activation; that
        // activation rule is independent of the six-player-only preference.
        const G = game(5);
        expect(G.minorInfluenceDefaults.hre).toEqual({papacy: 0, venice: 0, ireland: 0});
        expect(G.powers.hre.influence).toEqual({});
        activateHre(G);
        expect(G.powers.hre.influence).toEqual({papacy: 0, venice: 0, ireland: 0});
    });

    it("keeps the preference in six-player campaign games", () => {
        const G = game(6);
        expect(G.playerPowers).toBeUndefined();
        expect(G.powers.hre.influence).toEqual({papacy: 0, venice: 0, ireland: 0});
        expect(hreReligiousPreferenceEnabled(G)).toBe(true);
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(true);
        expect(hreReligiousPreferenceRequired(G, "england")).toBe(false);

        // The HRE's own Spring turn is blocked until the choice is recorded.
        expect(endPhaseTurn(G, spring(6))).toBe(INVALID_MOVE);
        expect(chooseHreReligiousPreference(G, spring(6), {preference: "catholic"})).toBeUndefined();
        expect(G.hreReligiousPreference).toBe("catholic");
        expect(G.hreReligiousPreferenceChosen).toBe(true);
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(false);
        expect(endPhaseTurn(G, spring(6))).toBeUndefined();
        // A second choice is rejected.
        expect(chooseHreReligiousPreference(G, spring(6), {preference: "balanced"}))
            .toBe(INVALID_MOVE);
    });

    it("keeps the preference in six-player tournament games and scores its printed rows", () => {
        const G = game(6, "tournament");
        expect(hreReligiousPreferenceEnabled(G)).toBe(true);
        expect(chooseHreReligiousPreference(G, spring(6), {preference: "catholic"})).toBeUndefined();
        G.protestantSpacesStart = 20;
        expect(hreReligiousVp(G)).toBe(3);
        G.protestantSpacesStart = 45;
        expect(hreReligiousVp(G)).toBe(0);
    });

    it("keeps the six-player preference secret from the other seats", () => {
        const G = game(6);
        expect(chooseHreReligiousPreference(G, spring(6), {preference: "catholic"})).toBeUndefined();
        const view = VirginQueenGameDef.playerView! as
            (G: VQGame, ctx: Ctx, playerID: string | null) => VQGame;
        expect(view(G, spring(6), "4").hreReligiousPreference).toBe("catholic");
        expect(view(G, spring(6), "1").hreReligiousPreference).toBeUndefined();
        expect(view(G, spring(6), null).hreReligiousPreference).toBeUndefined();
        G.hreReligiousPreferenceRevealed = true;
        expect(view(G, spring(6), "1").hreReligiousPreference).toBe("catholic");
    });

    it("keeps the Tutorial scenario outside the preference rule", () => {
        const G = setupGame(context(2), {scenario: "tutorial"});
        expect(hreReligiousPreferenceEnabled(G)).toBe(false);
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(false);
    });
});

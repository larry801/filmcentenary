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
 * Scenario Book p. 12: the five-player configuration seats one player per
 * power and leaves the HRE inactive.  The HRE is the only non-player major
 * power, and its Papacy/Venice/Ireland influence markers stay set aside until
 * an ally activates it.  Once activated, the HRE is a full power and records
 * the official secret religious preference in the first Spring.
 */
const context = (numPlayers = 5, extra: Partial<Ctx> = {}): Ctx => ({
    numPlayers,
    random: {Die: () => 3, Shuffle: (values: unknown[]) => values},
    ...extra,
} as unknown as Ctx);

const spring = (playerID = "2"): Ctx => context(5, {phase: "spring", currentPlayer: playerID});

const fivePlayerGame = (): VQGame => setupGame(context(), {scenario: "campaign"});

/** Activate the non-player HRE under England's control without a card event. */
const activateHre = (G: VQGame): void => {
    expect(activateMajor(G, context(), "hre", "england")).toBe(true);
    G.activePower = "hre";
};

describe("five-player HRE religious preference", () => {
    it("stays unavailable while the non-player HRE is inactive", () => {
        const G = fivePlayerGame();
        expect(hreReligiousPreferenceEnabled(G)).toBe(false);
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(false);
        expect(chooseHreReligiousPreference(G, spring(), {preference: "catholic"})).toBe(INVALID_MOVE);
        // Even a manually recorded preference earns no VP before activation.
        G.hreReligiousPreference = "catholic";
        expect(hreReligiousVp(G)).toBe(0);
        expect(chooseHreReligiousPreference(G, spring(), {preference: "balanced"})).toBe(INVALID_MOVE);
    });

    it("becomes available to the ally that activates the HRE", () => {
        const G = fivePlayerGame();
        activateHre(G);
        expect(G.activatedMajors!.hre).toEqual({ally: "england", baseline: expect.any(Number)});
        expect(hreReligiousPreferenceEnabled(G)).toBe(true);
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(true);
        // The preference follows the HRE's Spring turn, not another power's.
        expect(hreReligiousPreferenceRequired(G, "england")).toBe(false);
        expect(chooseHreReligiousPreference(G, spring(), {preference: "catholic"})).toBeUndefined();
        expect(G.hreReligiousPreference).toBe("catholic");
        expect(G.hreReligiousPreferenceChosen).toBe(true);
        expect(G.log.at(-1)).toBe("Holy Roman records its secret religious preference.");
        expect(chooseHreReligiousPreference(G, spring(), {preference: "balanced"})).toBe(INVALID_MOVE);
    });

    it("blocks the HRE's Spring turn until the preference is recorded", () => {
        const G = fivePlayerGame();
        activateHre(G);
        expect(endPhaseTurn(G, spring())).toBe(INVALID_MOVE);
        expect(chooseHreReligiousPreference(G, spring(), {preference: "balanced"})).toBeUndefined();
        expect(endPhaseTurn(G, spring())).toBeUndefined();
    });

    it("rejects the preference outside the HRE's own Spring turn", () => {
        const G = fivePlayerGame();
        activateHre(G);
        expect(chooseHreReligiousPreference(G, context(5, {phase: "diplomacy", currentPlayer: "2"}), {preference: "catholic"})).toBe(INVALID_MOVE);
        G.activePower = "england";
        expect(chooseHreReligiousPreference(G, spring(), {preference: "catholic"})).toBe(INVALID_MOVE);
        expect(hreReligiousPreferenceEnabled(G)).toBe(true);
    });

    it("keeps the Papacy/Venice/Ireland influence markers set aside until activation", () => {
        const G = fivePlayerGame();
        expect(G.minorInfluenceDefaults.hre).toEqual({papacy: 0, venice: 0, ireland: 0});
        expect(G.powers.hre.influence).toEqual({});
        activateHre(G);
        expect(G.powers.hre.influence).toEqual({papacy: 0, venice: 0, ireland: 0});
    });

    it("uses the printed Catholic row once the activated HRE has chosen", () => {
        const G = fivePlayerGame();
        activateHre(G);
        expect(chooseHreReligiousPreference(G, spring(), {preference: "catholic"})).toBeUndefined();
        G.protestantSpacesStart = 20;
        expect(hreReligiousVp(G)).toBe(3);
        G.protestantSpacesStart = 45;
        expect(hreReligiousVp(G)).toBe(0);
    });

    it("does not require the preference after the scenario's first turn", () => {
        const G = fivePlayerGame();
        activateHre(G);
        G.year = G.startTurn + 1;
        expect(hreReligiousPreferenceEnabled(G)).toBe(true);
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(false);
        expect(chooseHreReligiousPreference(G, spring(), {preference: "catholic"})).toBe(INVALID_MOVE);
        expect(hreReligiousVp(G)).toBe(0);
    });

    it("keeps the recorded preference secret from the other seats", () => {
        const G = fivePlayerGame();
        activateHre(G);
        expect(chooseHreReligiousPreference(G, spring(), {preference: "catholic"})).toBeUndefined();
        const view = VirginQueenGameDef.playerView! as (G: VQGame, ctx: Ctx, playerID: string | null) => VQGame;
        expect(view(G, spring(), "2").hreReligiousPreference).toBe("catholic");
        expect(view(G, spring(), "1").hreReligiousPreference).toBeUndefined();
        expect(view(G, spring(), null).hreReligiousPreference).toBeUndefined();
        G.hreReligiousPreferenceRevealed = true;
        expect(view(G, spring(), "1").hreReligiousPreference).toBe("catholic");
    });

    it.each([2, 3, 4] as const)("stays disabled in %i-player games even if the HRE is activated", (numPlayers) => {
        const G = setupGame(context(numPlayers), {scenario: "campaign"});
        G.activatedMajors!.hre = {ally: "england", baseline: powerVp(G, "hre")};
        G.activePower = "hre";
        expect(hreReligiousPreferenceEnabled(G)).toBe(false);
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(false);
        expect(chooseHreReligiousPreference(G, context(numPlayers, {phase: "spring", currentPlayer: "1"}), {preference: "catholic"})).toBe(INVALID_MOVE);
        G.hreReligiousPreference = "catholic";
        G.hreReligiousPreferenceRevealed = true;
        expect(hreReligiousVp(G)).toBe(0);
    });

    it("keeps the six-player preference and its markers unchanged", () => {
        const G = setupGame(context(6), {scenario: "campaign"});
        expect(G.playerPowers).toBeUndefined();
        expect(G.powers.hre.influence).toEqual({papacy: 0, venice: 0, ireland: 0});
        expect(hreReligiousPreferenceEnabled(G)).toBe(true);
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(true);
        expect(chooseHreReligiousPreference(G, context(6, {phase: "spring", currentPlayer: "4"}), {preference: "balanced"})).toBeUndefined();
    });

    it("keeps the Tutorial scenario outside the preference rule", () => {
        const G = setupGame(context(2), {scenario: "tutorial"});
        expect(hreReligiousPreferenceEnabled(G)).toBe(false);
        expect(hreReligiousPreferenceRequired(G, "hre")).toBe(false);
    });
});

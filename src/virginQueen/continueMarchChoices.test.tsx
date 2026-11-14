import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {Ctx} from "boardgame.io";
import {VirginQueenBoard} from "./components/board";
import {placeLabel} from "./components/board/helpers";
import {LAND_NEIGHBORS} from "./mapData";
import {continueMove, stopContinue} from "./moves";
import {setupGame} from "./util";

const context = (player = "3"): Ctx => ({
    currentPlayer: player,
    playerID: player,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

/**
 * France is stuck after a garrison withdrew into the fortress at Lyon.  Lyon is
 * used because it borders Turin across an Alpine pass, which is exactly the
 * 2 CP continuation the board used to hide.
 */
const ORIGIN = "dijon";
const SPACE = "lyon";
const state = () => {
    const G = setupGame({...context(), phase: "action"} as Ctx);
    G.activePower = "france";
    G.powers.france.cp = 2;
    G.powers.france.cardPlayed = true;
    G.pendingContinue = {power: "france", unitPower: "france", origin: ORIGIN, space: SPACE, units: {regular: 2, merc: 0, cav: 0}, leaders: []};
    G.spaces[SPACE].land = {france: {regular: 2, merc: 0, cav: 0}};
    G.spaces[ORIGIN].land = {france: {regular: 1, merc: 0, cav: 0}};
    return G;
};

const render = (G: ReturnType<typeof state>, playerID: string | null) =>
    renderToStaticMarkup(<VirginQueenBoard {...{
        G, ctx: {phase: "action", currentPlayer: playerID ?? "0"},
        moves: {}, playerID, isActive: false, hotseat: true,
    } as any}/>);

/** The rendered button whose text is exactly this place's label. */
/** The rendered button for a place, ignoring any " (2 CP)" cost suffix. */
const buttonFor = (html: string, id: string): string | undefined => {
    const label = placeLabel(id);
    const buttons = [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)];
    return buttons.find((match) => match[1].replace(/<[^>]*>/g, "").trim().startsWith(label))?.[0];
};

const neighbours = () => LAND_NEIGHBORS[SPACE].filter((entry) => entry.id !== ORIGIN);

describe("continue-march choices (rule 13.4)", () => {
    it("offers pass crossings as well as flat neighbours", () => {
        const G = state();
        const html = render(G, "3");
        const usable = neighbours().filter((entry) => G.spaces[entry.id] !== undefined);
        expect(usable.length).toBeGreaterThan(0);
        for (const entry of usable) expect(buttonFor(html, entry.id)).toBeDefined();
        // Lyon must have at least one pass crossing, otherwise this test is vacuous.
        expect(usable.some((entry) => entry.pass)).toBe(true);
    });

    it("enables pass crossings with 2 CP and disables them with 1 CP", () => {
        const G = state();
        G.powers.france.cp = 2;
        const rich = render(G, "3");
        for (const entry of neighbours().filter((n) => n.pass && G.spaces[n.id] !== undefined)) {
            expect(buttonFor(rich, entry.id)).not.toContain("disabled");
        }
        G.powers.france.cp = 1;
        const poor = render(G, "3");
        for (const entry of neighbours().filter((n) => n.pass && G.spaces[n.id] !== undefined)) {
            expect(buttonFor(poor, entry.id)).toContain("disabled");
        }
        for (const entry of neighbours().filter((n) => !n.pass && G.spaces[n.id] !== undefined)) {
            expect(buttonFor(poor, entry.id)).not.toContain("disabled");
        }
    });

    it("engine charges 2 CP over a pass and 1 CP for a flat move", () => {
        const G = state();
        const passNeighbour = neighbours().find((entry) => entry.pass && G.spaces[entry.id] !== undefined);
        const flatNeighbour = neighbours().find((entry) => !entry.pass && G.spaces[entry.id] !== undefined);
        expect(passNeighbour ?? flatNeighbour).toBeDefined();
        if (passNeighbour !== undefined) {
            G.powers.france.cp = 1;
            expect(continueMove(G, context(), {to: passNeighbour.id})).toBe("INVALID_MOVE");
            G.powers.france.cp = 2;
            G.spaces[passNeighbour.id].land = {};
            G.spaces[passNeighbour.id].control = "france";
            expect(continueMove(G, context(), {to: passNeighbour.id})).toBeUndefined();
            expect(G.powers.france.cp).toBe(0);
        }
        if (flatNeighbour !== undefined) {
            const fresh = state();
            fresh.spaces[flatNeighbour.id].land = {};
            fresh.spaces[flatNeighbour.id].control = "france";
            expect(continueMove(fresh, context(), {to: flatNeighbour.id})).toBeUndefined();
            expect(fresh.powers.france.cp).toBe(1);
        }
    });

    it("still lets the formation return to its origin", () => {
        const G = state();
        expect(stopContinue(G, context())).toBeUndefined();
        expect(G.spaces[ORIGIN].land.france.regular).toBe(3);
    });
});

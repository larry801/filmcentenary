import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {patronize} from "./moves";
import {patronDef} from "./scenario";
import {resolvePatronage, setupGame} from "./util";

const context = (values: number[] = [6], playerID = "3"): Ctx => ({
    currentPlayer: playerID,
    playerID,
    phase: "action",
    numPlayers: 6,
    random: {Die: () => values.shift() ?? 6, Shuffle: (cards: unknown[]) => [...cards].reverse()},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), numPlayers: 6} as Ctx);

describe("patrons are drawn at random (rules 22.1/22.2)", () => {
    it("ignores the requested patron id and draws from the pool", () => {
        const G = game();
        // France's pool holds several artists; ask for a specific one and check
        // the engine draws with the shuffled order instead.
        const artists = G.patronsAvailable.filter((id) => {
            const patron = patronDef(id);
            return patron?.region === "france" && patron.kind === "artist" && patron.rating !== null;
        });
        expect(artists.length).toBeGreaterThan(1);
        const requested = artists[0];
        G.powers.france.cp = 4;
        expect(patronize(G, context([6], "3"), {cp: 2, patron: requested})).toBeUndefined();
        // The reversed shuffle picks the last candidate, not the requested id.
        expect(G.pendingPatronage[0]?.patronId).toBe(artists[artists.length - 1]);
    });

    it("draws a scientist when the requested patron is a scientist", () => {
        const G = game();
        const scientists = G.patronsAvailable.filter((id) => {
            const patron = patronDef(id);
            return patron?.region === "france" && patron.kind === "scientist" && patron.rating !== null;
        });
        expect(scientists.length).toBeGreaterThan(0);
        G.powers.france.cp = 4;
        expect(patronize(G, context([6], "3"), {cp: 2, patron: scientists[0]})).toBeUndefined();
        expect(patronDef(G.pendingPatronage[0]?.patronId)?.kind).toBe("scientist");
    });
});

describe("Le Testu's scientist result removes his sea captain (rule 22.2)", () => {
    it("removes the sea captain when the scientist is removed", () => {
        const G = game();
        G.powers.france.seaCaptains = [...new Set([...G.powers.france.seaCaptains, "leTestu"])];
        G.pendingPatronage = [{power: "france", patronId: "leTestu", cp: 2}];
        // A total of 6 or less removes the scientist from play.
        resolvePatronage(G, context([1, 1]));
        expect(G.patronsAvailable).not.toContain("leTestu");
        expect(G.powers.france.seaCaptains).not.toContain("leTestu");
    });

    it("keeps the sea captain when the scientist returns to the pool", () => {
        const G = game();
        G.powers.france.seaCaptains = [...new Set([...G.powers.france.seaCaptains, "leTestu"])];
        G.pendingPatronage = [{power: "france", patronId: "leTestu", cp: 2}];
        // 1+1+rating 1 = 3 -> still 6 or less.  Use 4+4 to land on 9.
        resolvePatronage(G, context([4, 4]));
        expect(G.powers.france.seaCaptains).toContain("leTestu");
    });
});

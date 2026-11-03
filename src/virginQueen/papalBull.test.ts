import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {SPACES} from "./mapData";
import {patronById} from "./scenario";
import {setupGame, warCost} from "./util";

const context = (): Ctx => ({
    currentPlayer: "1",
    playerID: "1",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Papal Bull (card #5)", () => {
    it("can excommunicate Elizabeth", () => {
        const G = game();
        G.powers.spain.cards = ["vq-005"];
        G.powers.spain.alliedMinors = ["papacy"];
        G.minorDiplomacyResolved = [...new Set([...G.minorDiplomacyResolved, "papacy"])];

        expect(playCard(G, context(), {cardId: "vq-005", asEvent: true, target: "excommunicate"})).toBeUndefined();

        expect(G.elizabethExcommunicated).toBe(true);
    });

    it("can sponsor an Italian patron", () => {
        const G = game();
        G.powers.spain.cards = ["vq-005"];
        G.powers.spain.alliedMinors = ["papacy"];
        G.minorDiplomacyResolved = [...new Set([...G.minorDiplomacyResolved, "papacy"])];
        const patron = G.patronsAvailable.map((id) => patronById(G, id)).find((candidate) =>
            candidate?.region === "italy" && candidate.rating !== null && !G.powers.spain.patrons.includes(candidate.id));
        expect(patron).toBeDefined();

        expect(playCard(G, context(), {cardId: "vq-005", asEvent: true, target: `patron:${patron!.id}`})).toBeUndefined();

        expect(G.pendingPatronage.some((entry) => entry.patronId === patron!.id && entry.power === "spain")).toBe(true);
    });

    it("reduces the England-Spain war cost by 2", () => {
        const G = game();
        G.doWCostEnglandSpain = 6;
        expect(warCost(G, "england", "spain")).toBe(6);
        G.elizabethExcommunicated = true;
        expect(warCost(G, "england", "spain")).toBe(4);
    });

    it("can recover Holy League from the discard pile", () => {
        const G = game();
        G.powers.spain.cards = ["vq-005"];
        G.powers.spain.alliedMinors = ["papacy"];
        G.minorDiplomacyResolved = [...new Set([...G.minorDiplomacyResolved, "papacy"])];
        G.discard = ["vq-024"];

        expect(playCard(G, context(), {cardId: "vq-005", asEvent: true, target: "holyLeague"})).toBeUndefined();

        expect(G.discard).not.toContain("vq-024");
        expect(G.log.join("\n")).toContain("Holy League");
    });

    it("resolves the Papacy and makes Catholic attempts for its ally", () => {
        const G = game();
        G.powers.spain.cards = ["vq-005"];
        G.minorDiplomacyResolved = G.minorDiplomacyResolved.filter((minor) => minor !== "papacy");
        for (const power of ["ottoman", "spain", "england", "france", "hre", "protestant"] as const) {
            G.powers[power].influence.papacy = 0;
        }
        G.powers.spain.influence.papacy = 9;
        for (const space of SPACES.filter((def) => def.area === "france").slice(0, 3)) G.spaces[space.id].religion = "protestant";

        expect(playCard(G, context(), {cardId: "vq-005", asEvent: true})).toBeUndefined();

        expect(G.minorDiplomacyResolved).toContain("papacy");
        expect(G.log.some((line) => line.includes("Papal Bull"))).toBe(true);
    });
});

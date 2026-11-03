import {Ctx} from "boardgame.io";
import {VQGame} from "./constant/general";
import {playCard} from "./moves";
import {VirginQueenGameDef} from "./game";
import {SPACES} from "./mapData";
import {setupGame} from "./util";

const context = (): Ctx => ({
    currentPlayer: "3",
    playerID: "3",
    phase: "action",
    numPlayers: 6,
    random: {Die: () => 1, Shuffle: (cards: unknown[]) => cards},
} as unknown as Ctx);

const game = (): VQGame => setupGame({...context(), phase: "action"} as Ctx);

describe("Unrest in the Realm / Ruler Falls Ill", () => {
    it("places three unrest in Ottoman home spaces", () => {
        const G = game();
        G.powers.france.cards = ["vq-025"];
        for (const space of SPACES.filter((def) => def.home === "ottoman")) {
            G.spaces[space.id].land = {};
            G.spaces[space.id].unrest = false;
        }

        expect(playCard(G, context(), {cardId: "vq-025", asEvent: true, target: "ottoman"})).toBeUndefined();

        expect(SPACES.filter((space) => space.home === "ottoman" && G.spaces[space.id].unrest)).toHaveLength(3);
    });

    it("can skip the target's next action round", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain:skip"})).toBeUndefined();
        expect(G.skipImpulse).toContain("spain");

        G.activePower = "spain";
        const endTurn = jest.fn();
        const onBegin = VirginQueenGameDef.phases!.action!.turn!.onBegin as (g: VQGame, c: Ctx) => void;
        onBegin(G, {...context(), events: {endTurn}} as unknown as Ctx);
        expect(endTurn).toHaveBeenCalled();
        expect(G.skipImpulse).not.toContain("spain");
    });

    it("can send a target leader back to its capital", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.leaders.alba = {id: "alba", location: "rotterdam"};
        G.spaces.rotterdam.leaders = ["alba"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain:return"})).toBeUndefined();

        expect(G.leaders.alba.location).toBe("madrid");
        expect(G.spaces.rotterdam.leaders).not.toContain("alba");
    });

    it("returns a specifically named leader", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.leaders.parma = {id: "parma", location: "milan"};
        G.spaces.milan.leaders = ["parma"];
        G.leaders.alba = {id: "alba", location: "brussels"};
        G.spaces.brussels.leaders = ["alba"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain:return:parma"})).toBeUndefined();

        expect(G.leaders.parma.location).toBe("madrid");
        expect(G.leaders.alba.location).toBe("brussels");
    });

    it("does not return the Duke of Guise", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.leaders.guise = {id: "guise", location: "paris"};
        G.spaces.paris.leaders = ["guise"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "france:return"})).toBeUndefined();

        expect(G.leaders.guise.location).toBe("paris");
    });

    it("can discard a specifically named card", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-020", "vq-021"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain:discard:vq-021"})).toBeUndefined();

        expect(G.discard).toContain("vq-021");
        expect(G.powers.spain.cards).toContain("vq-020");
    });

    it("discards a random card from another power", () => {
        const G = game();
        G.powers.france.cards = ["vq-030"];
        G.powers.spain.cards = ["vq-020"];

        expect(playCard(G, context(), {cardId: "vq-030", asEvent: true, target: "spain"})).toBeUndefined();

        expect(G.powers.spain.cards).toHaveLength(0);
        expect(G.discard).toContain("vq-020");
    });
});

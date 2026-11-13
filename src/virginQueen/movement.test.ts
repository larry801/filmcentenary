import {Ctx} from "boardgame.io";
import {INVALID_MOVE} from "boardgame.io/core";
import {defaultFormation, landMoveIssue, transportMoveIssue} from "./movement";
import {moveLand, navalTransport} from "./moves";
import {setupGame} from "./util";

const ctx = {numPlayers: 2, currentPlayer: "0", playerID: "0", phase: "action",
    random: {Die: () => 3, Shuffle: (cards: unknown[]) => cards}} as unknown as Ctx;

it("stages a legal Istanbul formation that the engine accepts", () => {
    const G = setupGame(ctx, {scenario: "tutorial"});
    G.powers.ottoman.cp = 5;
    const formation = defaultFormation(G, "istanbul", "ottoman");
    expect(formation.units).toEqual({regular: 5, merc: 0, cav: 0});
    const order = {from: "istanbul", to: "edirne", ...formation};
    expect(landMoveIssue(G, "ottoman", order)).toBeUndefined();
    expect(moveLand(G, ctx, order)).toBeUndefined();
    expect(G.spaces.edirne.land.ottoman?.regular).toBe(5);
    expect(G.powers.ottoman.cp).toBe(4);
});

it("explains an over-capacity formation and rejects it without spending CP", () => {
    const G = setupGame(ctx, {scenario: "tutorial"});
    G.powers.ottoman.cp = 5;
    const order = {from: "istanbul", to: "edirne", units: {regular: 8, merc: 0, cav: 2},
        leaders: defaultFormation(G, "istanbul", "ottoman").leaders};
    expect(landMoveIssue(G, "ottoman", order)).toBe("formationCapacity");
    const before = JSON.stringify(G);
    expect(moveLand(G, ctx, order)).toBe(INVALID_MOVE);
    expect(JSON.stringify(G)).toBe(before);
});

it("caps a leaderless transported formation at four and diagnoses a broken route", () => {
    const G = setupGame(ctx, {scenario: "tutorial"});
    G.powers.ottoman.cp = 5;
    G.spaces.istanbul.leaders = [];
    const order = {from: "istanbul", to: "athens", zones: ["aegean"], ...defaultFormation(G, "istanbul", "ottoman", true)};
    expect(order.units.regular).toBe(4);
    expect(transportMoveIssue(G, "ottoman", order)).toBe("transportRoute");
    G.seaZones.aegean.naval.ottoman = {galley: 1, galleon: 0, racebuilt: 0, corsair: 0};
    expect(transportMoveIssue(G, "ottoman", order)).toBeUndefined();
    expect(navalTransport(G, ctx, order)).toBeUndefined();
    expect(G.powers.ottoman.cp).toBe(3);
});

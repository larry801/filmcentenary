import {InitializeGame} from "boardgame.io/internal";
import {CreateGameReducer} from "boardgame.io/internal";
import {FilmCentenaryGame} from "../Game";
import {ExtensionMode, GameMode, GameTurnOrder, IEra, Region} from "../types/core";
import {CardRevealReason, ICardReveal, recordCardReveal} from "./cardReveal";
import {fillEmptySlots} from "./util";

const makeMove = (type: string, args: any, playerID: string) => ({
    type: "MAKE_MOVE",
    payload: {type, args: [args], playerID},
});

const setupArgs = {
    order: GameTurnOrder.FIXED,
    mode: GameMode.NORMAL,
    enableSchoolExtension: false,
    enableSchoolExtensionMuki: false,
    enableSchoolExtensionMuki2: false,
    enableSchoolExtensionDawn: false,
    enableSchoolExtensionQM: false,
    enableExtensionChaosMedia: false,
    extensionMode: ExtensionMode.NONE,
    disableUndo: false,
    testModeCinema: false,
    testModeEnd180: false,
};

// 模拟一个 move 内的 ctx.log 插件 api
const fakeLogCtx = () => {
    const data: { metadata?: any } = {};
    const ctx: any = {log: {setMetadata: (m: any) => data.metadata = m}};
    return {ctx, data};
};

describe("cardReveal", () => {
    it("records new-era reveals for each region in the setupGameMode log entry", () => {
        const game = {...FilmCentenaryGame, seed: "reveal-test"};
        const reducer = CreateGameReducer({game, isClient: false});
        const initial = InitializeGame({game, numPlayers: 4});
        const state = reducer(initial, makeMove("setupGameMode", setupArgs, "0") as any);

        const entry = state.deltalog?.find(l => l.action.payload.type === "setupGameMode");
        const reveals: ICardReveal[] = entry?.metadata?.cardReveals;
        expect(reveals.map(r => r.region)).toEqual([Region.NA, Region.WE, Region.EE]);
        reveals.forEach(r => {
            expect(r.reason).toBe(CardRevealReason.NEW_ERA);
            expect(r.era).toBe(IEra.ONE);
            // @ts-ignore
            const region = state.G.regions[r.region];
            const onBoard = [region.legend, ...region.normal].map((s: any) => s.card);
            expect(r.cards).toEqual(onBoard);
        });
    });

    it("accumulates multiple reveals within one move and records refilled cards", () => {
        const game = {...FilmCentenaryGame, seed: "reveal-test"};
        const reducer = CreateGameReducer({game, isClient: false});
        const state = reducer(InitializeGame({game, numPlayers: 4}), makeMove("setupGameMode", setupArgs, "0") as any);
        const G = JSON.parse(JSON.stringify(state.G));
        const na = G.regions[Region.NA];
        // 时代1北美传奇牌只用1张、已翻开，故只清空普通牌位
        const removed = [na.normal[0].card, na.normal[1].card];
        na.normal[0].card = null;
        na.normal[1].card = null;

        const {ctx, data} = fakeLogCtx();
        recordCardReveal(ctx, {reason: CardRevealReason.UPDATE, cards: ["B01" as any]});
        const filled = fillEmptySlots(G, ctx, CardRevealReason.REFILL);

        expect(filled).toHaveLength(2);
        expect(filled).not.toEqual(removed);
        expect(data.metadata.cardReveals).toEqual([
            {reason: CardRevealReason.UPDATE, cards: ["B01"]},
            {reason: CardRevealReason.REFILL, cards: filled},
        ]);
    });

    it("skips empty reveals and missing log plugin", () => {
        const {ctx, data} = fakeLogCtx();
        recordCardReveal(ctx, {reason: CardRevealReason.REFILL, cards: []});
        expect(data.metadata).toBeUndefined();
        expect(() => recordCardReveal({} as any, {reason: CardRevealReason.REFILL, cards: ["B01" as any]})).not.toThrow();
    });
});

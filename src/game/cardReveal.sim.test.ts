import {Client} from "boardgame.io/client";
import {Stage} from "boardgame.io/core";
import {FilmCentenaryGame} from "../Game";
import {buyCardArgEnumerate, enumerateMoves} from "./ai";
import {actualStage} from "./util";
import {CardID, ExtensionMode, GameMode, GameTurnOrder, getCardById, IEra, Region, valid_regions} from "../types/core";
import {CardRevealReason, ICardReveal} from "./cardReveal";

// 用无界面 Client 随机走完整局，检查整局的翻牌记录。
// 内置 AI 只买基础牌、从不更新，这里额外加入买中央牌列和更新的走法。

jest.mock("./logger", () => ({logger: {info: () => {}, debug: () => {}, warn: () => {}, error: () => {}}}));

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
    disableUndo: true,
    testModeCinema: false,
    testModeEnd180: false,
};

const mulberry32 = (a: number) => () => {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
};

type Move = { move: string, args?: any[] };

const boardCards = (G: any, numPlayers: number): CardID[] => {
    const slots = numPlayers > 2 ?
        valid_regions.flatMap(r => [G.regions[r].legend, ...G.regions[r].normal]) :
        [...G.twoPlayer.school, ...G.twoPlayer.film];
    return slots.map((s: any) => s.card).filter((c: CardID | null) => c !== null);
};

const MAX_STEPS = 5000;

const playGame = (numPlayers: number, seed: number) => {
    const rand = mulberry32(seed);
    const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
    const client: any = Client({game: {...FilmCentenaryGame, seed: `sim-${seed}`}, numPlayers} as any);
    client.start();
    client.updatePlayerID("0");
    client.moves.setupGameMode(setupArgs);

    let steps = 0;
    let stuck = 0;
    let updatedTurn = -1;
    while (steps < MAX_STEPS) {
        const {G, ctx} = client.getState();
        if (ctx.gameover !== undefined) break;
        const p: string = ctx.activePlayers ? pick(Object.keys(ctx.activePlayers)) : ctx.currentPlayer;
        client.updatePlayerID(p);

        const base: Move[] = enumerateMoves(G, ctx, p);
        let preferred: Move[] = [];
        if (actualStage(G, ctx) === "payAdditionalCost") {
            const extra = G.e.extraCostToPay;
            const pub = G.pub[parseInt(p)];
            const deposit = Math.max(extra - pub.resource, 0);
            preferred = [{move: "payAdditionalCost", args: [{res: extra - deposit, deposit}]}];
        }
        if (ctx.phase === "NormalPhase" && actualStage(G, ctx) === Stage.NULL) {
            const cards = boardCards(G, numPlayers);
            preferred = cards.flatMap(c => buyCardArgEnumerate(G, ctx, p, getCardById(c)));
            // 每回合最多更新一次
            if (updatedTurn !== ctx.turn && cards.length > 0 && rand() < 0.3) {
                preferred.unshift({move: "updateSlot", args: [{p, cardId: pick(cards), slot: null, updateHistoryIndex: 0}]});
            }
        }

        // AI 枚举的走法可能非法，失败就换一个
        let remaining = [...preferred, ...base];
        let moved = false;
        while (remaining.length > 0 && !moved) {
            const pref = remaining.filter(m => preferred.includes(m));
            const nonEnd = remaining.filter(m => m.move !== "requestEndTurn");
            const pool = pref.length > 0 && rand() < 0.7 ? pref : nonEnd.length > 0 && rand() < 0.7 ? nonEnd : remaining;
            const m = pick(pool);
            remaining = remaining.filter(x => x !== m);
            const before = client.getState()._stateID;
            client.moves[m.move](...(m.args ?? []));
            moved = client.getState()._stateID !== before;
            if (moved && m.move === "updateSlot") updatedTurn = ctx.turn;
        }
        stuck = moved ? 0 : stuck + 1;
        // AI 未覆盖的交互阶段：提前结束，只校验已产生的记录
        if (stuck > 50) return {client, steps, state: client.getState(), stoppedAt: `turn${ctx.turn}|${actualStage(G, ctx)}`};
        steps++;
    }
    return {client, steps, state: client.getState(), stoppedAt: ""};
};

const allReveals = (log: any[]) => log.flatMap(l =>
    (l.metadata?.cardReveals ?? []).map((r: ICardReveal) => ({...r, move: l.action.payload.type})));

describe.each([[4, 1], [4, 2], [3, 3], [3, 4], [2, 5], [2, 6]])("full game %ip seed %i", (numPlayers, seed) => {
    it("records consistent card reveals across all eras", () => {
        const {client, steps, state, stoppedAt} = playGame(numPlayers, seed);
        const {G, ctx} = state;
        const reveals = allReveals(client.log);
        const summary: Record<string, number> = {};
        reveals.forEach(r => {
            const k = r.reason + (r.era === undefined ? "" : `@era${r.era + 1}`);
            summary[k] = (summary[k] ?? 0) + 1;
        });
        process.stdout.write(`[sim] ${numPlayers}p seed${seed} steps=${steps} gameover=${JSON.stringify(ctx.gameover)} stoppedAt=${stoppedAt} reveals=${JSON.stringify(summary)}\n`);

        expect(steps).toBeGreaterThan(100);
        reveals.forEach(r => {
            expect(Object.values(CardRevealReason)).toContain(r.reason);
            expect(r.cards.length).toBeGreaterThan(0);
            r.cards.forEach((c: any) => expect(typeof c).toBe("string"));
        });

        // 更新翻出的牌与 G.updateCardHistory（空结果除外）逐条一致
        const updates = reveals.filter(r => r.reason === CardRevealReason.UPDATE);
        updates.forEach(r => expect(r.move).toBe("updateSlot"));
        expect(updates.length).toBeGreaterThan(0);
        expect(updates.map(r => r.cards)).toEqual(G.updateCardHistory.filter((h: any[]) => h.length > 0));

        // 时代开牌记录：从时代1起连续；多人局带地区，两人局不带
        const newEra = reveals.filter(r => r.reason === CardRevealReason.NEW_ERA);
        const eras = Array.from(new Set(newEra.map(r => r.era))).sort();
        if (numPlayers === 4) {
            expect(eras).toEqual([IEra.ONE, IEra.TWO, IEra.THREE].slice(0, eras.length));
            expect(newEra.filter(r => r.era === IEra.ONE).map(r => r.region)).toEqual([Region.NA, Region.WE, Region.EE]);
        }
        newEra.forEach(r => numPlayers > 2 ? expect(r.region).toBeDefined() : expect(r.region).toBeUndefined());
    });
});

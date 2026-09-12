import {Ctx, LogEntry, PlayerID} from 'boardgame.io';
import {IG} from '../src/types/setup';
import {
    BasicCardID,
    BuildingType,
    CardID,
    ClassicCardID,
    EventCardID,
    getCardById,
    IEra,
    Region,
    SchoolCardID,
    valid_regions,
    ValidRegion
} from '../src/types/core';
import {drawForRegion} from '../src/game/util';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** Deterministic PRNG so measurements are comparable between runs. */
const mulberry32 = (seed: number) => () => {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const pick = <T>(rnd: () => number, arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

const take = <T>(rnd: () => number, arr: T[], n: number): T[] => {
    const out: T[] = [];
    for (let i = 0; i < n && arr.length > 0; i++) {
        out.push(arr.splice(Math.floor(rnd() * arr.length), 1)[0]);
    }
    return out;
};

/** Every classic card id in the game, used to fill piles realistically. */
const classicCardPool = (): ClassicCardID[] => {
    const pool: ClassicCardID[] = [];
    ([Region.NA, Region.WE, Region.EE, Region.ASIA] as ValidRegion[]).forEach(r => {
        ([IEra.ONE, IEra.TWO, IEra.THREE] as IEra[]).forEach(e => {
            // cardsByCond is the same source the real deck building uses.
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const {cardsByCond} = require('../src/types/core');
            cardsByCond(r, e, false).forEach((c: any) => pool.push(c.cardId));
            cardsByCond(r, e, true).forEach((c: any) => pool.push(c.cardId));
        });
    });
    return Array.from(new Set(pool));
};

export interface ILateGame {
    G: IG;
    log: LogEntry[];
    ctx: Ctx;
}

/**
 * Turn an initial (freshly set up) game state into a plausible *late game* state:
 * era 3 boards, full piles, growth histories and a long move log.
 */
export const makeLateGame = (initialG: IG, initialCtx: Ctx, opts: { logLength?: number } = {}): ILateGame => {
    const logLength = opts.logLength ?? 1200;
    const rnd = mulberry32(20240912);
    const G = clone(initialG);
    const ctx = clone(initialCtx);
    ctx.phase = 'NormalPhase';
    ctx.turn = 90;

    // ---- board: everything is in the last era, slots are full -----------------
    valid_regions.forEach((r: ValidRegion) => {
        G.regions[r].era = IEra.THREE;
        drawForRegion(G, ctx, r, IEra.THREE);
        G.regions[r].share = 1;
        G.regions[r].buildings.forEach((b, idx) => {
            b.activated = idx === 0 || idx === 1;
            b.owner = b.activated ? (idx % G.playerCount).toString() : '';
            b.building = b.activated ? (idx === 0 ? BuildingType.cinema : BuildingType.studio) : null;
        });
        G.regions[r].normal.forEach(slot => {
            slot.comment = null;
        });
    });

    const pool = classicCardPool();
    const schoolIds = Object.values(SchoolCardID);
    const eventIds = Object.values(EventCardID);
    G.events = take(rnd, [...eventIds], 2);
    G.basicCards = {B01: 3, B02: 2, B03: 1, B04: 6, B05: 4, B06: 0, B07: 0};

    // ---- players: piles, hands, awards, history -------------------------------
    for (let p = 0; p < G.playerCount; p++) {
        const pub = G.pub[p];
        const priv = G.player[p];
        const dealt = take(rnd, pool, 34);
        pub.discard = dealt.slice(0, 14);
        pub.archive = dealt.slice(14, 20);
        pub.playedCardInTurn = dealt.slice(20, 22);
        priv.hand = dealt.slice(22, 27);
        priv.handSize = priv.hand.length;
        pub.handSize = priv.hand.length;
        priv.cardsToPeek = [];
        priv.deckEmpty = false;
        G.secretInfo.playerDecks[p] = dealt.slice(27);
        pub.allCards = [...dealt];
        pub.school = schoolIds[p % schoolIds.length];
        pub.shares = {
            0: p === 0 ? 3 : 1,
            1: p === 1 ? 3 : 1,
            2: p === 2 ? 2 : 1,
            3: p === 3 ? 2 : 1,
        } as any;
        pub.champions = [
            {region: Region.NA, era: IEra.TWO},
            {region: Region.WE, era: IEra.THREE},
            {region: Region.EE, era: IEra.ONE},
        ];
        pub.industry = 8 + p;
        pub.aesthetics = 6 + p;
        pub.vp = 40 + p * 7;
        pub.resource = 12;
        pub.deposit = 9;
        pub.competitionPower = 4 + p;
        pub.action = 3;
        pub.building = {cinemaBuilt: true, studioBuilt: p % 2 === 0};
        pub.revealedHand = dealt.slice(22, 24);
        pub.tempStudios = [Region.NA, Region.WE];
        pub.scoreEvents = take(rnd, [...eventIds], 1);
        pub.handsize_startturn = 4;
        pub.vpAward = {v60: false, v90: false, v120: false, v150: false};
    }

    // card-update history grows all game long
    G.updateCardHistory = [];
    for (let i = 0; i < 40; i++) {
        G.updateCardHistory.push(take(rnd, pool, 2));
    }

    G.pending = {
        nextEraRegions: [],
        lastRoundOfGame: true,
        endActivePlayer: false,
        endTurn: true,
        endPhase: false,
        endStage: false,
        firstPlayer: '2',
    };
    G.e.stack = [];
    G.e.card = null;
    G.currentScoreRegion = Region.NONE;
    G.scoringRegions = [];

    // ---- client-side log (this is what the board renders) ---------------------
    const log: LogEntry[] = [];
    const moveNames = ['buyCard', 'playCard', 'drawCard', 'updateSlot', 'comment', 'breakthrough'];
    for (let i = 0; i < logLength; i++) {
        const pid = (i % G.playerCount).toString();
        if (i % 21 === 0) {
            log.push({
                action: {type: 'GAME_EVENT', payload: {type: 'endTurn', args: [], playerID: pid}},
                _stateID: i,
                turn: Math.floor(i / 21) + 1,
                phase: 'NormalPhase',
            } as unknown as LogEntry);
            continue;
        }
        const type = moveNames[i % moveNames.length];
        const card = pick(rnd, pool);
        let args: any[];
        switch (type) {
            case 'buyCard':
                args = [{
                    target: card,
                    buyer: pid,
                    resource: 3,
                    deposit: 1,
                    helper: take(rnd, pool, 2),
                }];
                break;
            case 'playCard':
            case 'breakthrough':
                args = [{idx: i % 5, card, playerID: pid, res: 0}];
                break;
            case 'updateSlot':
                args = [{slot: {card, region: Region.NA, isLegend: false, comment: null}, p: pid, cardId: card, updateHistoryIndex: i % 40}];
                break;
            case 'comment':
                args = [{target: card, comment: BasicCardID.B01, p: pid}];
                break;
            default:
                args = [{p: pid}];
        }
        log.push({
            action: {type: 'MAKE_MOVE', payload: {type, args, playerID: pid}},
            _stateID: i,
            turn: Math.floor(i / 21) + 1,
            phase: 'NormalPhase',
            metadata: {updatedResult: [pick(rnd, pool), pick(rnd, pool)]},
        } as unknown as LogEntry);
    }

    return {G, log, ctx};
};

/** Sanity helper: count the things that the board keeps re-computing. */
export const describeState = (G: IG, log: LogEntry[]) => ({
    cardsOnBoard: valid_regions.reduce((n, r) => n + G.regions[r].normal.filter(s => s.card !== null).length + (G.regions[r].legend.card !== null ? 1 : 0), 0),
    logEntries: log.length,
    totalDiscard: G.pub.reduce((n, p) => n + p.discard.length, 0),
    totalArchive: G.pub.reduce((n, p) => n + p.archive.length, 0),
    updateCardHistory: G.updateCardHistory.length,
    gKB: +(JSON.stringify(G).length / 1024).toFixed(1),
    basicCards: getCardById(BasicCardID.B05).name,
});

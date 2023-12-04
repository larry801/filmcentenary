import {PlanID} from "./plan";
import {CardID, LetterOfCredence, Level, SJPlayer, SongEarlyCardID} from "./general";
import {CityID} from "./city";
import {Ctx} from "boardgame.io";
import {shuffle} from "../../game/util";

export interface SJPubInfo {
    military: Level;
    civil: Level;
    plan: PlanID,
    completedPlan: PlanID[],
    emperor: CityID | null,
    corruption: number,
    unitBank: number[],
    discard: CardID,
    remove: CardID,
}

export interface SJPlayerInfo {
    hand: CardID[],
    combatCard: CardID[],
    plans: PlanID[],
    lod: LetterOfCredence[]
}

export const emptyPlayerInfo: () => SJPlayerInfo = () => {
    return {
        hand: [],
        combatCard: [],
        plans: [],
        lod: []
    }

}

export interface SongJinnGame {
    round: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    turn: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
    policy: -3 | -2 | -1 | 0 | 1 | 2 | 3,
    colony: 0 | 1 | 2 | 3 | 4,
    player: {
        [SJPlayer.P1]: SJPlayerInfo,
        [SJPlayer.P2]: SJPlayerInfo,
    }
    // combat: CombatInfo,
    secret: {
        songDeck: CardID[],
        jinnDeck: CardID[],
        planDeck: PlanID[],
    },
    first: SJPlayer,
}

export const setupSongJinn: (ctx: Ctx, setupData: any) => SongJinnGame = (ctx: Ctx, setupData: any) => {
    const {random} = ctx;
    const songDeck = shuffle(ctx, SongEarlyCardID);
    const jinnDeck = shuffle(ctx, []);
    const planDeck = shuffle(ctx, [
        PlanID.J01,
        PlanID.J02,
        PlanID.J03,
        PlanID.J04,
        PlanID.J05,
        PlanID.J06
    ])
    return {
        round: 1,
        turn: 1,
        first: SJPlayer.P1,
        policy: -2,
        colony: 2,
        player: {
            [SJPlayer.P1]: emptyPlayerInfo(),
            [SJPlayer.P2]: emptyPlayerInfo(),
        },
        secret: {
            songDeck: songDeck,
            jinnDeck: jinnDeck,
            planDeck: planDeck,
        },
    }
}
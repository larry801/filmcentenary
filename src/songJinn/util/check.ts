import {SongJinnGame} from "../constant/setup";
import {Ctx, PlayerID} from "boardgame.io";
import {addLateTermCard, addMidTermCard, remove} from "./card";
import {ActiveEvents, CardID} from "../constant/general";
import {logger} from "../../game/logger";
import {getStateById} from "./fetch";
import {totalDevelop} from "./calc";
import {sjCardById} from "../constant/cards";

export const endTurnCheck = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`t${G.turn}endTurnCheck`];
    if (G.turn === 2) {
        addMidTermCard(G, ctx);
    }
    if (G.turn === 6) {
        addLateTermCard(G, ctx);
    }
    if (G.events.includes(ActiveEvents.YueShuaiZhiLai)) {
        log.push(`|RemoveYueShuaiZhiLai|${G.events.toString()}`);
        remove(ActiveEvents.YueShuaiZhiLai, G.events);
        log.push(`|after|${G.events.toString()}`);
    }
    remove(ActiveEvents.LiGang, G.events);
    G.turn++;
    logger.debug(log.join(''));
}

export const endRoundCheck = (G: SongJinnGame, ctx: Ctx) => {
    const log = [`t${G.turn}r${G.round}endRoundCheck`];
    if (G.round === 3) {
        ctx.events?.setPhase('develop')
    }
    if (G.order[1] === ctx.playerID) {
        G.round++;
    }
    logger.debug(log.join(''));
}

export const returnDevCardCheck = (G: SongJinnGame, ctx: Ctx, pid: PlayerID, cid: CardID) => {
    const pub = getStateById(G, pid);
    const card = sjCardById(cid);
    return totalDevelop(G, ctx, pid) - pub.usedDevelop > card.op;
}


export const heYiCheck = (G: SongJinnGame, ctx: Ctx) => {
    return G.policy < 0;
}
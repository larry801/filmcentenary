import {SongJinnGame} from "../constant/setup";
import {Ctx} from "boardgame.io";
import {addLateTermCard, addMidTermCard, remove} from "./card";
import {ActiveEvents} from "../constant/general";
import {logger} from "../../game/logger";

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
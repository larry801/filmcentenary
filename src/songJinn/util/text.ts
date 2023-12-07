import {SJPlayer, TroopPlace} from "../constant/general";
import {getRegionById} from "../constant/regions";
import {LogEntry, PlayerID} from "boardgame.io";
import {ActionShape} from "boardgame.io/src/types";
import {sjCardById} from "../constant/cards";
import {getPlanById, PlanID} from "../constant/plan";

export const placeToStr = (p: TroopPlace) => {
    return typeof p === "number" ? getRegionById(p).name : p
}

export const sjPlayerName = (l: PlayerID): string => {
    return l === SJPlayer.P1 ? "宋" : "金";
}
export const getLogText = (l: LogEntry): string => {
    const s = sjPlayerName(l.action.payload.playerID);
    switch (l.action.type) {
        case "MAKE_MOVE":
            let log = s;
            const arg = l.action.payload.args;
            const name = l.action.payload.type;
            switch (name) {
                case 'showPlan':
                    log += `选择了${arg.map((p:PlanID)=>getPlanById(p).name)}`;
                    break;
                case 'choosePlan':
                    log += '选择了一张作战计划';
                    break;
                case 'op':
                    log += `打出${sjCardById(arg).name}`;
                    break;
                case 'cardEvent':
                    log += `事件${sjCardById(arg).name}`;
                    break;
                case 'developCard':
                    log += `发展${sjCardById(arg).name}`;
                    break;
                case 'develop':
                    log += `选择了${arg}`;
                    break;
                case 'letter':
                    log += `向${arg.nation}递交了国书`;
                    break;
                case 'heYi':
                    log += `用${sjCardById(arg).name}和议`;
                    break;
                case 'tieJun':
                    log += `用${sjCardById(arg).name}贴军`
                    break;
                case 'endRound':
                    log += `结束行动`
                    break;
                default:
                    log += `${name}|${JSON.stringify(arg)}`
            }
            return log;
        case "GAME_EVENT":
            return `${s}${l.action.payload.type}`;
        case "UNDO":
            return s + "撤销";
        case "REDO":
            return s + "恢复";
        default:
            return "";
    }
}
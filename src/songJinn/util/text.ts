import {SJEventCardID, DevelopChoice, SJPlayer, TroopPlace} from "../constant/general";
import {getRegionById} from "../constant/regions";
import {LogEntry, PlayerID} from "boardgame.io";
import {sjCardById} from "../constant/cards";
import {getPlanById, PlanID} from "../constant/plan";
import {getCityById} from "../constant/city";
import {unitsToString} from "./fetch";

export const placeToStr = (p: TroopPlace) => {
    return typeof p === "number" && !isNaN(p) ? getRegionById(p).name : p;
}

export const sjPlayerName = (l: PlayerID): string => {
    return l === SJPlayer.P1 ? "宋" : "金";
}
export const getLogText = (l: LogEntry): string => {
    const payload = l.action.payload;
    const s = sjPlayerName(payload.playerID);
    switch (l.action.type) {
        case "MAKE_MOVE":
            let log = s;
            try {
                const name = payload.type;
                const args = payload.args !== undefined ? payload.args : "";
                if (args === null || args === []) {
                    switch (name) {
                        case 'choosePlan':
                            log += '选择了一张作战计划';
                            break;
                        case 'endRound':
                            log += `结束行动`;
                            break;
                        default:
                            log += `${name}|${JSON.stringify(args)}`;
                    }
                } else {
                    const arg = args[0];
                    switch (name) {
                        case 'deploy':
                            log += `在${placeToStr(arg.city)}补充${unitsToString(arg.units)}`;
                            break;
                        case 'removeUnit':
                            log += `移除${placeToStr(arg.dst)}${unitsToString(arg.units)}`;
                            break;
                        case 'placeUnits':
                            log += `在${placeToStr(arg.dst)}放置${unitsToString(arg.units)}`;
                            break;
                        case 'opponentMove':
                            log += `让对方操作`;
                            break;
                        case 'takeDamage':
                            log += `死${unitsToString(arg.standby)}溃${unitsToString(arg.ready)}`;
                            break;
                        case 'march':
                            log += `${placeToStr(arg.src)}${unitsToString(arg.units)}进军${placeToStr(arg.dst)}`;
                            break;
                        case 'placeTroop':
                            log += `${placeToStr(arg.src.p)}${placeToStr(arg.dst)}`;
                            break;
                        case 'moveTroop':
                            log += `${placeToStr(arg.src.p)}全军移动到${placeToStr(arg.dst)}`;
                            break;
                        case 'rollDices':
                            log += `扔了${arg === undefined ? 5 : arg}个骰子`;
                            break;
                        case 'chooseFirst':
                            log += `选择${sjPlayerName(arg)}先行动`;
                            break;
                        case 'combatCard':
                            log += arg.length === 0 ? "不使用战斗牌" :
                                `使用战斗牌${arg.map((p: SJEventCardID) => sjCardById(p).name)}`;
                            break;
                        case 'takePlan':
                            log += `拿走了${arg.map((p: PlanID) => getPlanById(p).name)}`;
                            break;
                        case 'chooseTop':
                            log += `把${getPlanById(arg).name}放在最上面`;
                            break;
                        case 'showPlan':
                            log += `展示${arg.map((p: PlanID) => getPlanById(p).name)}`;
                            break;

                        case 'loseProvince':
                            log += `丢失了${arg.province}${arg.opponent ? "对手占领" : ""}`
                            break;
                        case 'loseCity':
                            log += `丢失${arg.cityID}${arg.opponent ? "对手占领" : ""}`;
                            break;


                        case 'discard':
                            log += `弃牌${sjCardById(arg).name}`;
                            break;
                        case 'search':
                            log += `检索${sjCardById(arg).name}`;
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
                        case 'down':
                            log += `降低${arg}`;
                            break;
                        case 'develop':
                            log += `${arg !== DevelopChoice.EMPEROR ? "提升" : ""}${arg}`;
                            break;
                        case 'recruitUnit':
                            log += `征募${unitsToString(arg)}`;
                            break;
                        case 'recruitPuppet':
                            log += `在${getCityById(arg).name}征募签军`;
                            break;
                        case 'emperor':
                            log += `在${getCityById(arg).name}拥立`;
                            break;
                        case 'letter':
                            log += `向${arg.nation}递交了国书`;
                            break;
                        case 'heYi':
                            log += `用${sjCardById(arg).name}和议`;
                            break;
                        case 'tieJun':
                            log += `用${sjCardById(arg).name}贴军`;
                            break;
                        case 'paiQian':
                            log += `用${sjCardById(arg).name}派遣`;
                            break;
                        case 'choosePlan':
                            log += '选择了一张作战计划';
                            break;
                        case 'endRound':
                            log += `结束行动`;
                            break;
                        default:
                            log += `|${JSON.stringify(name)}|${JSON.stringify(arg)}`
                    }
                }
            } catch (e) {
                log += `|${JSON.stringify(l)}|${e.toString()}|${JSON.stringify(e.stackTrace)}`
            }
            return log;
        case "GAME_EVENT":
            return `${s}${payload.type}`;
        case "UNDO":
            return s + "撤销";
        case "REDO":
            return s + "恢复";
        default:
            return "";
    }
}
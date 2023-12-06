import {Ctx, Game, PlayerID, TurnConfig} from "boardgame.io";
import {setupSongJinn, SongJinnGame} from "./constant/setup";
import {PlayerView, TurnOrder} from "boardgame.io/core";
import {
    ActionPhaseConfig,
    ChooseFirstPhaseConfig,
    ChoosePlanPhaseConfig, DrawPhaseConfig,
    NormalTurnConfig,
    ShowPlanPhaseConfig
} from "./constant/config";
import {getJinnPower, getSongPower} from "./util/calc";
import {SJPlayer, VictoryType} from "./constant/general";


export const SongJinnGameDef: Game<SongJinnGame> = {
    setup: setupSongJinn,
    name: "songjinn",
    minPlayers: 2,
    maxPlayers: 2,
    playerView: PlayerView.STRIP_SECRETS,
    phases: {
        draw: DrawPhaseConfig,
        chooseFirst: ChooseFirstPhaseConfig,
        choosePlan: ChoosePlanPhaseConfig,
        showPlan: ShowPlanPhaseConfig,
        action: ActionPhaseConfig,
    },
    turn: NormalTurnConfig,
    endIf: (G: SongJinnGame, ctx: Ctx) => {
        if (getSongPower(G) < 3) {
            return {
                winner: SJPlayer.P2,
                type: VictoryType.PowerOfNation
            }
        }
        if (getJinnPower(G) < 3) {
            return {
                winner: SJPlayer.P1,
                type: VictoryType.PowerOfNation
            }
        }
    }
}



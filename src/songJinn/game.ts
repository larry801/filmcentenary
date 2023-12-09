import {Ctx, Game} from "boardgame.io";
import {setupSongJinn, SongJinnGame} from "./constant/setup";
import {PlayerView} from "boardgame.io/core";
import {
    ActionPhaseConfig,
    ChooseFirstPhaseConfig,
    ChoosePlanPhaseConfig, DeployPhaseConfig,
    DevelopPhaseConfig, DiplomacyPhaseConfig,
    DrawPhaseConfig,
    NormalTurnConfig, ResolvePlanPhaseConfig,
    ShowPlanPhaseConfig, TurnEndPhaseConfig
} from "./constant/config";
import {getJinnPower, getSongPower} from "./util/calc";
import {Country, SJPlayer, VictoryType} from "./constant/general";
import {diplomaticVictory} from "./util/fetch";


export const SongJinnGameDef: Game<SongJinnGame> = {
    setup: setupSongJinn,
    name: "songJinn",
    minPlayers: 2,
    maxPlayers: 2,
    playerView: PlayerView.STRIP_SECRETS,
    phases: {
        draw: DrawPhaseConfig,
        chooseFirst: ChooseFirstPhaseConfig,
        choosePlan: ChoosePlanPhaseConfig,
        showPlan: ShowPlanPhaseConfig,

        action: ActionPhaseConfig,

        resolvePlan: ResolvePlanPhaseConfig,
        diplomacy:DiplomacyPhaseConfig,
        develop: DevelopPhaseConfig,
        deploy: DeployPhaseConfig,
        turnEnd: TurnEndPhaseConfig,
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
        const dipVic = diplomaticVictory(G);
        if (dipVic !== null) {
            switch (dipVic) {
                case Country.JINN:
                    return {
                        winner: SJPlayer.P2,
                        type: VictoryType.Diplomacy
                    }
                case Country.SONG:
                    return {
                        winner: SJPlayer.P2,
                        type: VictoryType.Diplomacy
                    }
            }
        }
        const completedPlanDelta = G.song.completedPlan.length - G.jinn.completedPlan.length;
        if (completedPlanDelta >= 4) {
            return {
                winner: SJPlayer.P1,
                type: VictoryType.StrategicPlan
            }
        }
        if (completedPlanDelta <= -4) {
            return {
                winner: SJPlayer.P2,
                type: VictoryType.StrategicPlan
            }
        }
    }
}



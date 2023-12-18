import {Ctx, Game, PlayerID} from "boardgame.io";
import {PlayerView} from "boardgame.io/core";
import {
    ActionPhaseConfig,
    ChooseFirstPhaseConfig,
    ChoosePlanPhaseConfig,
    DeployPhaseConfig,
    DevelopPhaseConfig,
    DiplomacyPhaseConfig,
    DrawPhaseConfig,
    NormalTurnConfig,
    ResolvePlanPhaseConfig,
    ShowPlanPhaseConfig,
    TurnEndPhaseConfig
} from "./constant/config";
import {Country, setupSongJinn, SJPlayer, SongJinnGame, VictoryReason} from "./constant/general";
import {diplomaticVictory, getJinnPower, getSongPower} from "./util";


export const SongJinnGameDef: Game<SongJinnGame> = {
    setup: setupSongJinn,
    name: "songJinn",
    minPlayers: 2,
    maxPlayers: 2,
    playerView: (G: SongJinnGame, ctx: Ctx, playerID: PlayerID | null) => {
        let r = JSON.parse(JSON.stringify(G));
        r.song.handCount = r.player['0'].hand.length;
        r.jinn.handCount = r.player['1'].hand.length;
        if (playerID === null) {
            delete r.player
        } else {
            if (playerID === SJPlayer.P1) {
                delete r.player['1']
            } else {
                delete r.player['0']
            }
        }
        if (r.secret !== undefined) {
            delete r.secret;
        }
        return r;
    },
    phases: {
        draw: DrawPhaseConfig,
        chooseFirst: ChooseFirstPhaseConfig,
        choosePlan: ChoosePlanPhaseConfig,
        showPlan: ShowPlanPhaseConfig,

        action: ActionPhaseConfig,

        resolvePlan: ResolvePlanPhaseConfig,
        diplomacy: DiplomacyPhaseConfig,
        develop: DevelopPhaseConfig,
        deploy: DeployPhaseConfig,
        turnEnd: TurnEndPhaseConfig,
    },
    turn: NormalTurnConfig,
    endIf: (G: SongJinnGame, ctx: Ctx) => {
        if (getSongPower(G) <= 3) {
            return {
                winner: SJPlayer.P2,
                reason: VictoryReason.PowerOfNation
            }
        }
        if (getJinnPower(G) <= 3) {
            return {
                winner: SJPlayer.P1,
                reason: VictoryReason.PowerOfNation
            }
        }
        const dipVic = diplomaticVictory(G);
        if (dipVic !== null) {
            switch (dipVic) {
                case Country.JINN:
                    return {
                        winner: SJPlayer.P2,
                        reason: VictoryReason.Diplomacy
                    }
                case Country.SONG:
                    return {
                        winner: SJPlayer.P2,
                        reason: VictoryReason.Diplomacy
                    }
            }
        }
        const completedPlanDelta = G.song.completedPlan.length - G.jinn.completedPlan.length;
        if (completedPlanDelta >= 4) {
            return {
                winner: SJPlayer.P1,
                reason: VictoryReason.StrategicPlan
            }
        }
        if (completedPlanDelta <= -4) {
            return {
                winner: SJPlayer.P2,
                reason: VictoryReason.StrategicPlan
            }
        }
        if (G.jinn.emperor === null) {
            return {
                winner: SJPlayer.P1,
                reason: VictoryReason.ZhiDaoHuangLong
            }
        }
    }
}



import React from "react";
import {BoardProps} from "boardgame.io/react";
import {SongJinnGame} from "../constant/setup";
import ErrorBoundary from "../../components/error";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {
    Country,
    SJPlayer, UNIT_SHORTHAND

} from "../constant/general";
import {getPlanById} from "../constant/plan";
import {getStateById, playerById, getCountryById, getStage} from "../util/fetch";
import Button from "@material-ui/core/Button";
import {getCityById} from "../constant/city";
import {getRegionById} from "../constant/regions";
import {sjCardById} from "../constant/cards";
import {remainDevelop} from "../util/calc";
import {PubInfo} from "./pub-info";
import {Operation} from "./operation";
import PlayerHand from "../../components/player-hand";
import {SJPlayerHand} from "./player-hand";
import LogView from "./view-log";
import {sjPlayerName} from "../util/text";
import TroopOperation from "./troops";

export const SongJinnBoard = ({
                                  G,
                                  log,
                                  ctx,
                                  events,
                                  moves,
                                  undo,
                                  redo,
                                  matchData,
                                  matchID,
                                  playerID,
                                  isActive,
                                  isMultiplayer,
                                  isConnected
                              }: BoardProps<SongJinnGame>) => {

    const pub = getStateById(G, playerID as SJPlayer);
    const player = playerById(G, playerID as SJPlayer);
    const country = getCountryById(playerID as SJPlayer);


    return <ErrorBoundary>
        <Grid container>
            {ctx.gameover !== undefined && <ChoiceDialog callback={()=>{}} choices={[]} defaultChoice={""} show={true} title={`${sjPlayerName(ctx.gameover.winner)}胜利 ${ctx.gameover.reason}`} toggleText={"游戏结束"} initial={true}/>}
            {isActive && <Grid item>
                <PubInfo G={G} ctx={ctx}/>
                <LogView log={log} getPlayerName={sjPlayerName} G={G}/>
            </Grid>}

            {playerID !== null &&
                <Grid>
                    <Button onClick={()=>undo()} >撤回</Button>
                    <Operation
                        G={G} ctx={ctx}
                        playerID={playerID}
                        moves={moves}
                        isActive={isActive}
                    />
                    {isActive && <Grid>
                        <SJPlayerHand
                            moves={moves}
                            G={G} ctx={ctx}
                            isActive={isActive}
                            pid={playerID}
                        />
                        <TroopOperation G={G} ctx={ctx} isActive={isActive} pid={playerID} moves={moves}/>

                    </Grid>

                    }
                </Grid>
            }
        </Grid>
    </ErrorBoundary>
}
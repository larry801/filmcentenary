import React from "react";
import {BoardProps} from "boardgame.io/react";
import {SongJinnGame} from "../constant/setup";
import ErrorBoundary from "../../components/error";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {SJPlayer} from "../constant/general";
import {getStateById, playerById, getCountryById} from "../util/fetch";
import Button from "@material-ui/core/Button";
import {PubInfo} from "./pub-info";
import {Operation} from "./operation";
import {SJPlayerHand} from "./player-hand";
import LogView from "./view-log";
import {sjPlayerName, troopToString} from "../util/text";
import TroopOperation from "./troops";
import {AdjustOps} from "./adjust";
import {ChatMessage} from "./chat-message";
import Paper from "@material-ui/core/Paper";

export const SongJinnBoard = ({
                                  G,
                                  log,
                                  ctx,
                                  moves,
                                  undo,
                                  sendChatMessage,
                                  chatMessages,
                                  playerID,
                                  isActive,
                                  matchID
                              }: BoardProps<SongJinnGame>) => {

    const pub = getStateById(G, playerID as SJPlayer);
    const player = playerById(G, playerID as SJPlayer);
    const country = getCountryById(playerID as SJPlayer);

    const empty = (c: string) => {
    };
    return <ErrorBoundary>
        <Grid container>
            {ctx.gameover !== undefined && <ChoiceDialog
                callback={empty} choices={[]} defaultChoice={""} show={true}
                title={`${sjPlayerName(ctx.gameover.winner)}胜利 ${ctx.gameover.reason}`}
                toggleText={"游戏结束"} initial={true}/>}
            {<Grid container item xs={12}>
                <Grid item xs={12} sm={6}>
                    <PubInfo G={G} ctx={ctx}/>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <LogView log={log} getPlayerName={sjPlayerName} G={G}/>
                </Grid>
            </Grid>}

            {playerID !== null ?
                <Grid>
                    {isActive ? <Grid container>
                        <Button onClick={() => undo()}>撤回</Button>
                        <Operation
                            G={G} ctx={ctx}
                            playerID={playerID}
                            moves={moves}
                            isActive={isActive}
                            matchID={matchID}
                        />
                        <Grid item xs={12} sm={6}>
                            <TroopOperation G={G} ctx={ctx} isActive={isActive} pid={playerID} moves={moves}/>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <SJPlayerHand moves={moves} G={G} ctx={ctx} isActive={isActive} pid={playerID}/>
                        </Grid>
                        <ChatMessage
                            sendChatMessage={sendChatMessage}
                            chatMessages={chatMessages}
                            getPlayerName={sjPlayerName}/>
                        <AdjustOps G={G} ctx={ctx} isActive={isActive} playerID={playerID} moves={moves}/>
                    </Grid> : <Grid container>
                        <Grid item xs={12} sm={6}>
                            <TroopOperation G={G} ctx={ctx} isActive={isActive} pid={playerID} moves={moves}/>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <SJPlayerHand moves={moves} G={G} ctx={ctx} isActive={isActive} pid={playerID}/>
                        </Grid>
                    </Grid>
                    }
                </Grid>
                : <Grid item container>
                    <Grid xs={12} sm={6}>
                        {
                            G.song.troops.map(
                                (t, idx) => {
                                    return <Grid xs={12} sm={6} key={`troop-song-grid-${idx}`}>
                                        <Paper key={`troop-song-${idx}`}>{troopToString(G, SJPlayer.P1, t)}
                                        </Paper></Grid>
                                }
                            )
                        }

                    </Grid>
                    <Grid xs={12} sm={6}>
                        {
                            G.jinn.troops.map((t, idx) => {
                                    return <Grid xs={12} sm={6} key={`troop-jinn-grid-${idx}`}>
                                        <Paper key={`troop-jinn-${idx}`}>{troopToString(G, SJPlayer.P2, t)}
                                        </Paper></Grid>
                                }
                            )
                        }

                    </Grid>
                </Grid>
            }
        </Grid>
    </ErrorBoundary>
}
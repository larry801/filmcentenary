import React from "react";
import {BoardProps} from "boardgame.io/react";
import ErrorBoundary from "../../components/error";
import Grid from "@material-ui/core/Grid";
import ChoiceDialog from "../../components/modals";
import {SJPlayer, SongJinnGame} from "../constant/general";
import Button from "@material-ui/core/Button";
import {PubInfo} from "./pub-info";
import {Operation} from "./operation";
import {SJPlayerHand} from "./player-hand";
import LogView from "./view-log";
import TroopOperation from "./troops";
import {AdjustOps} from "./adjust";
import {ChatMessage} from "./chat-message";
import Paper from "@material-ui/core/Paper";
import {getCountryById, getStateById, playerById, sjPlayerName, troopToString} from "../util";
// @ts-ignore
import disconnectedSfx from '../../components/media/connect.mp3'
// @ts-ignore
import playerTurnSfx from '../../components/media/turn.mp3';
import {playConnectedSound, playSound, usePrevious} from "../../components/board";
import Typography from "@material-ui/core/Typography";
import i18n from "../../constant/i18n";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import {useI18n} from "@i18n-chain/react";
import {TroopsMap} from "./map";
import {GeoMap} from "./geo";
import {ParentSize} from "@visx/responsive";

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
                                  isConnected,
                                  isMultiplayer,
                                  matchID
                              }: BoardProps<SongJinnGame>) => {
    useI18n(i18n);
    const [open, setOpen] = React.useState(true);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);

    const disconnectNotice = isConnected ? <></> :
        <>
            <Button
                fullWidth
                style={{textTransform: 'none'}}
                onClick={handleOpen}
                color="secondary"
                variant={"outlined"}
            >
                <Typography>
                    {i18n.disconnected}
                </Typography>
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>
                    <Typography variant="h5" component="h1">
                        {i18n.disconnected}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {i18n.disconnected}
                </DialogContent>
            </Dialog>
        </>

    const prevIsActive = usePrevious(isActive);
    const prevIsConnected = usePrevious(isConnected);

    React.useEffect(() => {
        if (isMultiplayer && !isConnected && prevIsConnected) {
            playConnectedSound();
        }
    }, [prevIsConnected, isConnected])

    React.useEffect(() => {
        if (isActive && prevIsActive === false) {
            playSound();
        }
    }, [prevIsActive, isActive])

    const pub = getStateById(G, playerID as SJPlayer);
    const player = playerById(G, playerID as SJPlayer);
    const country = getCountryById(playerID as SJPlayer);

    const empty = (c: string) => {
    };
    return <ErrorBoundary>
        <Grid container>
            {disconnectNotice}
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
                <Grid item xs={12} sm={6}>
                    <ParentSize>
                        {parent => <GeoMap G={G} moves={moves} height={640} width={parent.width}/>}
                    </ParentSize>
                </Grid>
                <Grid item xs={12} sm={6}>
                    <ChatMessage
                        sendChatMessage={sendChatMessage}
                        chatMessages={chatMessages}
                        getPlayerName={sjPlayerName}/>
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
import React from "react";
import {BoardProps} from "boardgame.io/react";
import {IG} from "../types/setup";
import {BoardCardSlot, BoardRegion, SchoolRegion} from "./region";
import {activePlayer} from "../game/util";
import i18n from "../constant/i18n";
import {PlayerID} from "boardgame.io";
import Button from "@material-ui/core/Button";
import PubPanel from "./pub";
import {
    BasicCardID,
    EventCardID,
    ICardSlot,
    Region,
    SimpleRuleNumPlayers,
    valid_regions
} from "../types/core";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Paper from "@material-ui/core/Paper";
import LogView from './log-view';
import DeckIcon from '@material-ui/icons/Layers';
import NormalCardIcon from '@material-ui/icons/RadioButtonUnchecked';
import LegendCardIcon from '@material-ui/icons/StarBorder';
import {useI18n} from "@i18n-chain/react";
import OperationPanel from "./boards/operation";
import FinalScoreTable from "./boards/final";
import {getCardName} from "./card";
import {nanoid} from "nanoid";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import SetupPanel from "./boards/setup-game-mode";
// @ts-ignore
import disconnectedSfx from './media/connect.mp3'
// @ts-ignore
import playerTurnSfx from './media/turn.mp3';
import {ChampionIcon, DrawnShareIcon} from "./icons";
import Dialog from "@material-ui/core/Dialog";
import ErrorBoundary from "./error";

let sound: HTMLAudioElement;
let connectedSound: HTMLAudioElement;

export const playConnectedSound = () => {
    if (!connectedSound) {
        connectedSound = new Audio(disconnectedSfx);
    }
    connectedSound.play().then(() => {
    });
}

export const playSound = () => {
    if (!sound) {
        sound = new Audio(playerTurnSfx);
    }
    sound.play().then(() => {
    });
};


export function usePrevious(value: any) {
    const ref = React.useRef();

    React.useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref.current;
}

export const FilmCentenaryBoard = ({
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
                                   }: BoardProps<IG>) => {

    useI18n(i18n);
    const canMoveCurrent = ctx.currentPlayer === playerID && activePlayer(ctx) === playerID;
    const canMoveOutOfTurn = ctx.currentPlayer !== playerID && activePlayer(ctx) === playerID;
    const canMove = ctx.currentPlayer === playerID ? canMoveCurrent : canMoveOutOfTurn;
    const curPlayerSuffix = "(*)";
    const connectedPrefix = "---";
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

    const locale = i18n._.getLocaleName();

    React.useEffect((): () => void => {
        document.title = (isActive ? curPlayerSuffix : "") + i18n.title;
        return () => document.title = i18n.title;
    }, [isActive, locale])

    const getName = (playerID: PlayerID | null = ctx.currentPlayer): string => {
        const fallbackName = i18n.playerName.player + playerID;
        const curSuffix = ctx.currentPlayer === playerID ? curPlayerSuffix : ""
        const activeSuffix = activePlayer(ctx) === playerID && ctx.currentPlayer !== playerID ? "(**)" : ""
        const markSuffix = G.regionScoreCompensateMarker === playerID ? "" : ""
        let name = "";
        if (playerID === null) {
            return i18n.playerName.spectator
        } else {
            if (matchData === undefined) {
                name = fallbackName
            } else {
                let arr = matchData.filter(m => m.id.toString() === playerID)
                if (arr.length === 0) {
                    name = fallbackName
                } else {
                    if (arr[0].name === undefined) {
                        name = fallbackName;
                    } else {
                        name = arr[0].name
                    }
                }
            }
        }
        return `${name}${curSuffix}${activeSuffix}${markSuffix}`
    }

    const comment = (slot: ICardSlot, card: BasicCardID | null) => moves.comment({
        target: slot.card,
        comment: card,
        p: playerID
    })

    const showBoardStatus = () => {
        const args = ctx.numPlayers > SimpleRuleNumPlayers ? {
            regions: [
                G.regions[Region.NA],
                G.regions[Region.WE],
                G.regions[Region.EE],
                G.regions[Region.ASIA],
                G.regions[Region.EXTENSION],
            ],
            school: [],
            film: [],
            matchID: matchID,
        } : {
            regions: [],
            school: G.twoPlayer.school,
            film: G.twoPlayer.film,
            matchID: matchID,
        }
        moves.showBoardStatus(args);
    }

    const endPhase = () => events?.endPhase?.();

    const cardBoard = ctx.numPlayers === SimpleRuleNumPlayers ?
        <Grid item container xs={12} sm={7}>
            <Grid item xs={12} sm={6}>
                <Typography>
                    {valid_regions.map(r => {
                        const regionIdx: 0 | 1 | 2 | 3 | 4 = r;
                        const region = G.regions[regionIdx];
                        return <React.Fragment key={nanoid()}>
                            <DrawnShareIcon r={r}/>{region.share}
                        </React.Fragment>;
                    })}
                    <ChampionIcon champion={{
                        region: Region.NONE,
                        era: G.twoPlayer.era
                    }}/><DeckIcon/><LegendCardIcon/>{G.twoPlayer.schoolDeckLength}<NormalCardIcon/>{G.twoPlayer.filmDeckLength}
                </Typography>
            </Grid>
            <Grid item xs={12}>
                <BoardCardSlot slot={G.twoPlayer.school[0]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid item xs={12}>
                <BoardCardSlot slot={G.twoPlayer.school[1]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid item xs={12}>
                <BoardCardSlot slot={G.twoPlayer.film[0]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid item xs={12}>
                <BoardCardSlot slot={G.twoPlayer.film[1]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid item xs={12}>
                <BoardCardSlot slot={G.twoPlayer.film[2]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid item xs={12}>
                <BoardCardSlot slot={G.twoPlayer.film[3]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
        </Grid> :

        <Grid item container xs={12} sm={7}>
            <BoardRegion getPlayerName={getName} r={Region.NA} moves={moves} region={G.regions[0]} G={G} ctx={ctx}
                         playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.WE} moves={moves} region={G.regions[1]} G={G} ctx={ctx}
                         playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.EE} moves={moves} region={G.regions[2]} G={G} ctx={ctx}
                         playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.ASIA} moves={moves} region={G.regions[3]} G={G} ctx={ctx}
                         playerID={playerID}/>
            <SchoolRegion getPlayerName={getName} r={Region.NONE} moves={moves} region={G.regions[4]} G={G} ctx={ctx}
                          playerID={playerID}/>
        </Grid>

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

    const gameOverResult = ctx.gameover === undefined ? <></> :
        <>
            <Button
                fullWidth
                style={{textTransform: 'none'}}
                onClick={handleOpen}
                color="secondary"
                variant={"outlined"}
            >
                <Typography>
                    {i18n.gameOver.title}
                </Typography>
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>
                    <Typography variant="h5" component="h1">
                        {i18n.gameOver.title}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <Paper variant="elevation">
                        <Typography variant="h6" component="h2">{
                            // @ts-ignore
                            i18n.gameOver.reason[ctx.gameover.reason]
                        }</Typography>
                        <Typography variant="h6" component="h2">{i18n.gameOver.winner}</Typography>
                        <Typography variant="h6" component="h2">{getName(ctx.gameover.winner)}</Typography>
                    </Paper>
                    <FinalScoreTable G={G} ctx={ctx} getName={getName}/>
                </DialogContent>
            </Dialog>
        </>
    const upperPanel = playerID !== null ? <>
            {ctx.phase === "InitPhase" ?
                isActive ? <Grid item xs={12}>
                    <SetupPanel ctx={ctx} moves={moves}/>
                    <Button
                        fullWidth
                        autoFocus
                        variant="contained"
                        color={"primary"}
                        size="large"
                        disabled={!canMove}
                        onClick={showBoardStatus}>
                        {i18n.action.showBoardStatus}
                    </Button>
                    {G.pending.endPhase && canMoveCurrent ?
                        <Button
                            fullWidth
                            variant={"outlined"}
                            onClick={endPhase}
                        >
                            {i18n.action.endPhase}
                        </Button>
                        : <></>}
                </Grid> : <></>
                : <>
                    {cardBoard}
                    {ctx.gameover === undefined
                        ?
                        <OperationPanel
                            G={G} ctx={ctx}
                            moves={moves}
                            playerID={playerID}
                            events={events}
                            undo={undo} redo={redo}
                            getName={getName}
                            log={log}
                        />
                        : <></>}
                </>}
        </>
        : <></>

    return <ErrorBoundary>
        <Grid container justifyContent="flex-start" key={`film-centenary-board-player-${playerID}`}>
            {gameOverResult}
            {disconnectNotice}
            {G.pending.lastRoundOfGame && ctx.gameover === undefined ?
                <Grid item container xs={12} justifyContent="space-evenly">
                    <Paper variant="elevation">
                        <Typography variant="h4" component="h1">{i18n.pub.lastRoundOfGame}</Typography>
                    </Paper> </Grid> : <></>}
            {ctx.numPlayers !== SimpleRuleNumPlayers ? <Grid xs={12} spacing={2} container item>
                <Grid item xs={4}>
                    <Typography>{`${i18n.pub.events}(${G.eventDeckLength})`}</Typography
                    ></Grid>
                {G.events.map((e: EventCardID, idx: number) => <Grid key={idx} item xs={4}>
                    <Paper key={idx} elevation={5}>
                        <Typography>{getCardName(e)}</Typography>
                        <Typography>{i18n.eventName[e]}</Typography>
                    </Paper></Grid>)}
            </Grid> : <></>}
            {playerID === null ? cardBoard : <></>}
            {upperPanel}
            <Grid item container justifyContent="space-evenly">
                <Grid item><Typography>{i18n.card.B01} {G.basicCards.B01}</Typography></Grid>
                <Grid item><Typography>{i18n.card.B02} {G.basicCards.B02}</Typography></Grid>
                <Grid item><Typography>{i18n.card.B03} {G.basicCards.B03}</Typography></Grid>
                <Grid item><Typography>{i18n.card.B04} {G.basicCards.B04}</Typography></Grid>
                <Grid item><Typography>{i18n.card.B05} {G.basicCards.B05}</Typography></Grid>
            </Grid>
            {
                log === undefined ? <></> :
                    <LogView log={log} getPlayerName={getName} G={G}/>
            }
            {G.order.map((i: PlayerID) =>
                <Grid item sm={6} lg={3} key={`grid-pub-panel-${i}-${playerID}`}>
                    <ErrorBoundary>
                        <PubPanel log={log} ctx={ctx} i={G.pub[parseInt(i)]} key={nanoid()} G={G} idx={parseInt(i)}
                                  getName={getName}/>
                    </ErrorBoundary>
                </Grid>
            )}
            <FinalScoreTable G={G} ctx={ctx} getName={getName}/>
        </Grid>
    </ErrorBoundary>
}

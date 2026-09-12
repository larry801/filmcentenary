import React from "react";
import {BoardProps} from "boardgame.io/react";
import {IG} from "../types/setup";
import {BoardCardSlot, BoardRegion, SchoolRegion} from "./region";
import {activePlayer, getRegionRank} from "../game/util";
import {getValidHelper} from "../game/board-util";
import i18n from "../constant/i18n";
import {PlayerID} from "boardgame.io";
import Button from "@mui/material/Button";
import PubPanel from "./pub";
import {
    BasicCardID,
    EventCardID,
    ICardSlot,
    Region,
    SimpleRuleNumPlayers,
    valid_regions
} from "../types/core";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import LogView from './log-view';
import DeckIcon from '@mui/icons-material/Layers';
import NormalCardIcon from '@mui/icons-material/RadioButtonUnchecked';
import LegendCardIcon from '@mui/icons-material/StarBorder';
import OperationPanel from "./boards/operation";
import FinalScoreTable from "./boards/final";
import {getCardName} from "./card";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import SetupPanel from "./boards/setup-game-mode";
// @ts-ignore
import disconnectedSfx from './media/connect.mp3'
// @ts-ignore
import playerTurnSfx from './media/turn.mp3';
import {ChampionIcon, DrawnShareIcon} from "./icons";
import Dialog from "@mui/material/Dialog";
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
    const ref = React.useRef<any>(undefined);

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

    i18n.use();
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

    const locale = i18n.getLocaleName();

    React.useEffect((): () => void => {
        document.title = (isActive ? curPlayerSuffix : "") + i18n.chain.title;
        return () => document.title = i18n.chain.title;
    }, [isActive, locale])

    const activePid = activePlayer(ctx);
    // Names are used by every panel and every card slot, so they are computed
    // once per state instead of once per lookup.
    const names = React.useMemo((): Record<string, string> => {
        const map: Record<string, string> = {};
        for (let p = 0; p < ctx.numPlayers; p++) {
            const pid = p.toString();
            let name = i18n.chain.playerName.player + pid;
            if (matchData !== undefined) {
                const found = matchData.filter(m => m.id.toString() === pid);
                if (found.length > 0 && found[0].name !== undefined) {
                    name = found[0].name;
                }
            }
            const curSuffix = ctx.currentPlayer === pid ? curPlayerSuffix : "";
            const activeSuffix = activePid === pid && ctx.currentPlayer !== pid ? "(**)" : "";
            map[pid] = `${name}${curSuffix}${activeSuffix}`;
        }
        return map;
    }, [matchData, ctx.currentPlayer, activePid, locale]);

    const getName = React.useCallback((playerID: PlayerID | null = ctx.currentPlayer): string => {
        if (playerID === null) {
            return i18n.chain.playerName.spectator
        }
        const cached = names[playerID];
        return cached !== undefined ? cached : i18n.chain.playerName.player + playerID;
    }, [names, ctx.currentPlayer]);

    const comment = React.useCallback((slot: ICardSlot, card: BasicCardID | null) => moves.comment({
        target: slot.card,
        comment: card,
        p: playerID
    }), [moves, playerID]);

    // Cards that can pay for a purchase: identical for every card slot.
    const helpers = React.useMemo(
        () => (playerID === null ? [] : getValidHelper(G, playerID)),
        [G, playerID]
    );

    // Region rankings: one shared lookup per region instead of one per region
    // per panel (only the four-player board shows them).
    const regionRanks = React.useMemo(
        () => ctx.numPlayers > SimpleRuleNumPlayers
            ? valid_regions.map(r => getRegionRank(G, ctx, r))
            : [],
        [G, ctx, ctx.numPlayers]
    );

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
        <Grid container size={{xs: 12, sm: 7}}>
            <Grid size={{xs: 12, sm: 6}}>
                <Typography>
                    {valid_regions.map(r => {
                        const regionIdx: 0 | 1 | 2 | 3 | 4 = r;
                        const region = G.regions[regionIdx];
                        return <React.Fragment key={`region-share-${r}`}>
                            <DrawnShareIcon r={r}/>{region.share}
                        </React.Fragment>;
                    })}
                    <ChampionIcon champion={{
                        region: Region.NONE,
                        era: G.twoPlayer.era
                    }}/><DeckIcon/><LegendCardIcon/>{G.twoPlayer.schoolDeckLength}<NormalCardIcon/>{G.twoPlayer.filmDeckLength}
                </Typography>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.school[0]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.school[1]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.film[0]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.film[1]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.film[2]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
            <Grid size={12}>
                <BoardCardSlot slot={G.twoPlayer.film[3]} G={G} ctx={ctx} moves={moves} comment={comment}
                               playerID={playerID}/>
            </Grid>
        </Grid> :

        <Grid container size={{xs: 12, sm: 7}}>
            <BoardRegion getPlayerName={getName} r={Region.NA} moves={moves} region={G.regions[0]} G={G} ctx={ctx}
                         playerID={playerID} helpers={helpers}/>
            <BoardRegion getPlayerName={getName} r={Region.WE} moves={moves} region={G.regions[1]} G={G} ctx={ctx}
                         playerID={playerID} helpers={helpers}/>
            <BoardRegion getPlayerName={getName} r={Region.EE} moves={moves} region={G.regions[2]} G={G} ctx={ctx}
                         playerID={playerID} helpers={helpers}/>
            <BoardRegion getPlayerName={getName} r={Region.ASIA} moves={moves} region={G.regions[3]} G={G} ctx={ctx}
                         playerID={playerID} helpers={helpers}/>
            <SchoolRegion getPlayerName={getName} r={Region.NONE} moves={moves} region={G.regions[4]} G={G} ctx={ctx}
                          playerID={playerID} helpers={helpers}/>
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
                    {i18n.chain.disconnected}
                </Typography>
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>
                    <Typography variant="h5" component="h1">
                        {i18n.chain.disconnected}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    {i18n.chain.disconnected}
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
                    {i18n.chain.gameOver.title}
                </Typography>
            </Button>
            <Dialog open={open} onClose={handleClose}>
                <DialogTitle>
                    <Typography variant="h5" component="h1">
                        {i18n.chain.gameOver.title}
                    </Typography>
                </DialogTitle>
                <DialogContent>
                    <Paper variant="elevation">
                        <Typography variant="h6" component="h2">{
                            // @ts-ignore
                            i18n.chain.gameOver.reason[ctx.gameover.reason]
                        }</Typography>
                        <Typography variant="h6" component="h2">{i18n.chain.gameOver.winner}</Typography>
                        <Typography variant="h6" component="h2">{getName(ctx.gameover.winner)}</Typography>
                    </Paper>
                    <FinalScoreTable G={G} ctx={ctx} getName={getName}/>
                </DialogContent>
            </Dialog>
        </>
    const upperPanel = playerID !== null ? <>
            {ctx.phase === "InitPhase" ?
                isActive ? <Grid size={12}>
                    <SetupPanel ctx={ctx} moves={moves}/>
                    <Button
                        fullWidth
                        autoFocus
                        variant="contained"
                        color={"primary"}
                        size="large"
                        disabled={!canMove}
                        onClick={showBoardStatus}>
                        {i18n.chain.action.showBoardStatus}
                    </Button>
                    {G.pending.endPhase && canMoveCurrent ?
                        <Button
                            fullWidth
                            variant={"outlined"}
                            onClick={endPhase}
                        >
                            {i18n.chain.action.endPhase}
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
                            helpers={helpers}
                            regionRanks={regionRanks}
                        />
                        : <></>}
                </>}
        </>
        : <></>

    return <ErrorBoundary>
        <Grid container key={`film-centenary-board-player-${playerID}`} sx={{justifyContent: 'flex-start'}}>
            {gameOverResult}
            {disconnectNotice}
            {G.pending.lastRoundOfGame && ctx.gameover === undefined ?
                <Grid container size={12} sx={{justifyContent: 'space-evenly'}}>
                    <Paper variant="elevation">
                        <Typography variant="h4" component="h1">{i18n.chain.pub.lastRoundOfGame}</Typography>
                    </Paper> </Grid> : <></>}
            {ctx.numPlayers !== SimpleRuleNumPlayers ? <Grid spacing={2} container size={12}>
                <Grid size={4}>
                    <Typography>{`${i18n.chain.pub.events}(${G.eventDeckLength})`}</Typography
                    ></Grid>
                {G.events.map((e: EventCardID, idx: number) => <Grid key={idx} size={4}>
                    <Paper key={idx} elevation={5}>
                        <Typography>{getCardName(e)}</Typography>
                        <Typography>{i18n.chain.eventName[e]}</Typography>
                    </Paper></Grid>)}
            </Grid> : <></>}
            {playerID === null ? cardBoard : <></>}
            {upperPanel}
            <Grid container sx={{justifyContent: 'space-evenly'}}>
                <Grid><Typography>{i18n.chain.card.B01} {G.basicCards.B01}</Typography></Grid>
                <Grid><Typography>{i18n.chain.card.B02} {G.basicCards.B02}</Typography></Grid>
                <Grid><Typography>{i18n.chain.card.B03} {G.basicCards.B03}</Typography></Grid>
                <Grid><Typography>{i18n.chain.card.B04} {G.basicCards.B04}</Typography></Grid>
                <Grid><Typography>{i18n.chain.card.B05} {G.basicCards.B05}</Typography></Grid>
            </Grid>
            {
                log === undefined ? <></> :
                    <LogView log={log} getPlayerName={getName} G={G}/>
            }
            {G.order.map((i: PlayerID) =>
                <Grid key={`grid-pub-panel-${i}-${playerID}`} size={{sm: 6, lg: 3}}>
                    <ErrorBoundary>
                        <PubPanel log={log} ctx={ctx} i={G.pub[parseInt(i)]} G={G} idx={parseInt(i)}
                                  getName={getName} regionRanks={regionRanks}/>
                    </ErrorBoundary>
                </Grid>
            )}
            <FinalScoreTable G={G} ctx={ctx} getName={getName}/>
        </Grid>
    </ErrorBoundary>
}

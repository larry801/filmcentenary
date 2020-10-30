import React from "react";
import {BoardProps} from "boardgame.io/react";
import {IG} from "../types/setup";
import {BoardCardSlot, BoardRegion} from "./region";
import {activePlayer} from "../game/util";
import i18n from "../constant/i18n";
import {PlayerID} from "boardgame.io";
import Button from "@material-ui/core/Button";
import {PubPanel} from "./pub";
import {BasicCardID, EventCardID, ICardSlot, IPubInfo, Region, SimpleRuleNumPlayers, ValidRegions} from "../types/core";
import Grid from "@material-ui/core/Grid"
import Typography from "@material-ui/core/Typography";
import Paper from "@material-ui/core/Paper";
import LogView from './log-view'
import useSound from 'use-sound';
// @ts-ignore
import playerTurnSfx from './media/turn.mp3'
import {useI18n} from "@i18n-chain/react";
import {OperationPanel} from "./boards/operation";
import FinalScoreTable from "./boards/final";
import {getCardName} from "./card";

export function usePrevious(value: any) {
    const ref = React.useRef();

    React.useEffect(() => {
        ref.current = value;
    }, [value]);

    return ref.current;
}

export const FilmCentenaryBoard = ({G, log, ctx, events, moves, undo, redo, plugins, matchData, matchID, playerID, isActive}: BoardProps<IG>) => {

    useI18n(i18n);
    const canMoveCurrent = ctx.currentPlayer === playerID && activePlayer(ctx) === playerID;
    const canMoveOutOfTurn = ctx.currentPlayer !== playerID && activePlayer(ctx) === playerID;
    const canMove = ctx.currentPlayer === playerID ? canMoveCurrent : canMoveOutOfTurn;
    const curPlayerSuffix = "(*)"
    const prevIsActive = usePrevious(isActive);
    const [play] = useSound(playerTurnSfx);
    React.useEffect(() => {
        if (isActive && prevIsActive === false) {
            play()
        }
    }, [prevIsActive, isActive, play])

    const locale = i18n._.getLocaleName();

    React.useEffect((): () => void => {
        if (isActive) {
            document.title = curPlayerSuffix + i18n.title
        } else {
            document.title = i18n.title
        }
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
            ],
            school: [],
            film: [],
            matchID: matchID,
            seed: plugins.random.data.seed,
        } : {
            regions: [],
            school: G.twoPlayer.school,
            film: G.twoPlayer.film,
            matchID: matchID,
            seed: plugins.random.data.seed,
        }
        moves.showBoardStatus(args);
    }

    const endPhase = () => events?.endPhase?.();

    const cardBoard = ctx.numPlayers === SimpleRuleNumPlayers ?
        <Grid item container xs={12} sm={7}>
            <Grid item xs={12} sm={6}>
                <Typography>{i18n.pub.share}</Typography>
                {ValidRegions.map(r =>
                    <Grid key={`region-${r}-share`} item>
                        <Typography>{i18n.region[r]} {G.regions[r as 0 | 1 | 2 | 3].share}</Typography>
                    </Grid>)}
            </Grid>
            <Grid item xs={12} sm={6}>
                <Typography>
                    {
                        // @ts-ignore
                        i18n.era[G.twoPlayer.era]
                    }/{G.twoPlayer.schoolDeckLength}/{G.twoPlayer.filmDeckLength}</Typography>
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
        </Grid>

    const gameOverResult = ctx.gameover === undefined ? <></> : <Grid item xs={12}>
        <Paper variant="elevation">
            <Typography variant="h5">{i18n.gameOver.title}</Typography>
            <Typography variant="h6">{
                // @ts-ignore
                i18n.gameOver.reason[ctx.gameover.reason]
            }</Typography>
            <Typography variant="h5">{i18n.gameOver.winner}</Typography>
            <Typography variant="h6">{getName(ctx.gameover.winner)}</Typography>
        </Paper>
    </Grid>

    const upperPanel = playerID !== null ? <>
            {
                log === undefined ? <></> :
                    <LogView log={log.filter(l => l.action.payload.type !== "endStage")} getPlayerName={getName}/>
            }

            {ctx.phase === "InitPhase" ?
                <Grid item xs={12}>
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
                </Grid>
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
                            getName={getName}/>
                        : <></>}
                </>}
        </>
        : <>{cardBoard}</>

    return <Grid container justify="flex-start">
        {gameOverResult}
        {G.pending.lastRoundOfGame ? <Paper
            variant="elevation"
        >
            <Typography variant="h3">{i18n.pub.lastRoundOfGame}</Typography>
        </Paper> : <></>}
        {ctx.numPlayers !== SimpleRuleNumPlayers ? <Grid xs={12} spacing={2} container item>
            <Grid item xs={4}>
                <Typography>{`${i18n.pub.events}(${G.eventDeckCount})`}</Typography
                ></Grid>
            {G.events.map((e: EventCardID, idx: number) => <Grid key={idx} item xs={4}>
                <Paper key={idx} elevation={5}>
                    <Typography>{getCardName(e)}</Typography>
                    <Typography>{i18n.eventName[e]}</Typography>
                </Paper></Grid>)}
        </Grid> : <></>}
        {upperPanel}


        <Grid item container justify="space-evenly">
            <Grid item><Typography>{i18n.card.B01} {G.basicCards.B01}</Typography></Grid>
            <Grid item><Typography>{i18n.card.B02} {G.basicCards.B02}</Typography></Grid>
            <Grid item><Typography>{i18n.card.B03} {G.basicCards.B03}</Typography></Grid>
            <Grid item><Typography>{i18n.card.B04} {G.basicCards.B04}</Typography></Grid>
            <Grid item><Typography>{i18n.card.B05} {G.basicCards.B05}</Typography></Grid>
        </Grid>
        <FinalScoreTable G={G} ctx={ctx} getName={getName}/>

        {G.pub.map((u: IPubInfo, idx: number) =>
            <Grid container key={idx}>
                <Grid item xs={4} sm={3} md={2} lg={1}>
                    <Typography>
                        {getName(idx.toString())}
                    </Typography>
                </Grid>

                <Grid item xs={4} sm={3} md={2} lg={1}>
                    <Typography>{i18n.pub.handSize} {G.player[idx].handSize}</Typography>
                </Grid>
                <PubPanel G={G} i={u}/>
            </Grid>)}
    </Grid>
}

import React, {useEffect, useRef} from "react";
import {BoardProps} from "boardgame.io/react";
import {IG} from "../types/setup";
import {BoardCardSlot, BoardRegion} from "./region";
import {activePlayer, getCardName} from "../game/util";
import i18n from "../constant/i18n";
import {PlayerID} from "boardgame.io";
import Button from "@material-ui/core/Button";
import {PubPanel} from "./pub";
import {BasicCardID, ICardSlot, Region, SimpleRuleNumPlayers, ValidRegions} from "../types/core";
import Grid from "@material-ui/core/Grid"
import Typography from "@material-ui/core/Typography";
import Paper from "@material-ui/core/Paper";
import {LogView} from './log-view'
import useSound from 'use-sound';
// @ts-ignore
import playerTurnSfx from './media/turn.mp3'
import {useI18n} from "@i18n-chain/react";
import {OperationPanel} from "./boards/operation";
import FinalScoreTable from "./boards/final";

export function usePrevious(value: any) {
    const ref = useRef();

    useEffect(() => {
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
    useEffect(() => {
        if (isActive && prevIsActive === false) {
            play()
        }
        console.log(prevIsActive, isActive)
    }, [prevIsActive, isActive, play])

    const locale = i18n._.getLocaleName();

    useEffect((): () => void => {
        if (isActive) {
            document.title = curPlayerSuffix + i18n.title
        } else {
            document.title = i18n.title
        }
        return () => document.title = i18n.title;
    }, [isActive, locale])

    const getName = (playerID: PlayerID | null = ctx.currentPlayer): string => {
        const fallbackName = i18n.playerName.player + playerID;
        if (playerID === null) {
            return i18n.playerName.spectator
        } else {
            if (matchData === undefined) {
                if (ctx.currentPlayer === playerID) {
                    return fallbackName + curPlayerSuffix
                } else {
                    return fallbackName
                }
            } else {
                let arr = matchData.filter(m => m.id.toString() === playerID)
                if (arr.length === 0) {
                    if (ctx.currentPlayer === playerID) {
                        return fallbackName + curPlayerSuffix
                    } else {
                        return fallbackName
                    }
                } else {
                    if (arr[0].name === undefined) {
                        return fallbackName;
                    } else {
                        if (ctx.currentPlayer === playerID) {
                            return arr[0].name + curPlayerSuffix
                        } else {
                            return arr[0].name
                        }
                    }
                }
            }
        }
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
        <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}><Typography>{i18n.pub.share}</Typography></Grid>
            {ValidRegions.map(r => <Grid key={`region-${r}-share`}
                                         item><Typography>{i18n.region[r]} {G.regions[r as 0 | 1 | 2 | 3].share}</Typography></Grid>)}
            <BoardCardSlot slot={G.twoPlayer.school[0]} G={G} ctx={ctx} moves={moves} comment={comment}
                           playerID={playerID}/>
            <BoardCardSlot slot={G.twoPlayer.school[1]} G={G} ctx={ctx} moves={moves} comment={comment}
                           playerID={playerID}/>
            <BoardCardSlot slot={G.twoPlayer.film[0]} G={G} ctx={ctx} moves={moves} comment={comment}
                           playerID={playerID}/>
            <BoardCardSlot slot={G.twoPlayer.film[1]} G={G} ctx={ctx} moves={moves} comment={comment}
                           playerID={playerID}/>
            <BoardCardSlot slot={G.twoPlayer.film[2]} G={G} ctx={ctx} moves={moves} comment={comment}
                           playerID={playerID}/>
            <BoardCardSlot slot={G.twoPlayer.film[3]} G={G} ctx={ctx} moves={moves} comment={comment}
                           playerID={playerID}/>
        </Grid> :
        <Grid item container xs={12} sm={6}>
            <BoardRegion getPlayerName={getName} r={Region.NA} moves={moves} region={G.regions[0]} G={G} ctx={ctx}
                         playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.WE} moves={moves} region={G.regions[1]} G={G} ctx={ctx}
                         playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.EE} moves={moves} region={G.regions[2]} G={G} ctx={ctx}
                         playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.ASIA} moves={moves} region={G.regions[3]} G={G} ctx={ctx}
                         playerID={playerID}/>
        </Grid>
    const gameOverResult = ctx.gameover === undefined ? <></> : <Grid item xs={12} sm={6}>
        <Typography variant={"h2"}>{i18n.gameOver.title}</Typography>
        <Typography variant={"h3"}>{getName(ctx.gameover.winner)}</Typography>
    </Grid>


    return <Grid container justify="space-evenly" alignItems="center">
        {gameOverResult}
        {ctx.numPlayers !== SimpleRuleNumPlayers ? <Grid xs={12} spacing={2} container item>
            <Grid item xs={4}>
                <Typography>{i18n.pub.events}</Typography
            ></Grid>
            {G.events.map((e, idx) => <Grid key={idx} item xs={4}>
                <Paper key={idx} elevation={10}>
                    <Typography>{getCardName(e)}</Typography>
                    <Typography>{i18n.eventName[e]}</Typography>
                </Paper></Grid>)}
        </Grid> : <></>}

        {playerID !== null && ctx.gameover === undefined ?
            <OperationPanel G={G} ctx={ctx} moves={moves} playerID={playerID} events={events} undo={undo} redo={redo} getName={getName}/>
            :<></>}

        {playerID !== null && ctx.phase === "InitPhase" ?
            <Grid item xs={12}>
                <Button
                    fullWidth
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
            </Grid> : cardBoard
        }
        <Grid item container justify="space-evenly">
            <Grid item><Typography>{i18n.card.B01} {G.basicCards.B01}</Typography></Grid>
            <Grid item><Typography>{i18n.card.B02} {G.basicCards.B02}</Typography></Grid>
            <Grid item><Typography>{i18n.card.B03} {G.basicCards.B03}</Typography></Grid>
            <Grid item><Typography>{i18n.card.B04} {G.basicCards.B04}</Typography></Grid>
            <Grid item><Typography>{i18n.card.B05} {G.basicCards.B05}</Typography></Grid>
        </Grid>
        {G.pub.map((u, idx) =>
            <Grid container item key={idx} xs={12}>

                <Grid item xs={4} sm={3} md={2} lg={1}><Typography>{getName(idx.toString())}</Typography></Grid>
                <Grid item xs={4} sm={3} md={2} lg={1}><Typography>{i18n.pub.handSize} {G.player[idx].handSize}</Typography></Grid>
                <PubPanel G={G} i={u}/>
            </Grid>)}
        <FinalScoreTable G={G} ctx={ctx}/>
        {log === undefined ? <></> : <LogView log={log} getPlayerName={getName}/>}
        <Typography>{plugins.random.data.seed}</Typography>
    </Grid>
}

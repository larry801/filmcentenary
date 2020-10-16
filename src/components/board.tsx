import React, {useEffect, useRef} from "react";
import {BoardProps} from "boardgame.io/react";
import {IG, privatePlayer} from "../types/setup";
import {BoardCardSlot, BoardRegion} from "./region";
import {PlayerHand} from "./playerHand";
import {ChoiceDialog} from "./modals";
import {activePlayer, actualStage, effName, getCardName} from "../game/util";
import i18n from "../constant/i18n";
import {PlayerID} from "boardgame.io";
import Button from "@material-ui/core/Button";
import {PubPanel} from "./pub";
import {BasicCardID, CardCategory, CardID, ICardSlot, Region, SimpleRuleNumPlayers, ValidRegions} from "../types/core";
import {BuyCard} from "./buyCard";
import Grid from "@material-ui/core/Grid"
import Typography from "@material-ui/core/Typography";
import Paper from "@material-ui/core/Paper";
import {LogView} from './log-view'
import useSound from 'use-sound';
// @ts-ignore
import playerTurnSfx from './media/turn.mp3'
import {useI18n} from "@i18n-chain/react";
import {getCardById} from "../types/cards";

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
    const iPrivateInfo = playerID === null ? privatePlayer() : G.player[parseInt(playerID)];
    const hand = playerID === null ? [] : iPrivateInfo.hand
    const handChoices = playerID === null ? [] : hand.map((c, idx) => {
        return {
            label: getCardName(c),
            disabled: false,
            hidden: false,
            value: idx.toString()
        }
    })

    const peekChoicesDisabled = G.e.stack.length > 0 && G.e.stack[0].e === "peek" ? G.e.stack[0].eff.a.filter.e !== "choice" : true;

    const peek = (choice: string) => {
        moves.peek({
            idx: parseInt(choice),
            card: iPrivateInfo.cardsToPeek[parseInt(choice)],
            p: playerID,
        })
    }

    const chooseHand = (choice: string) => {
        moves.chooseHand({
            hand: hand[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID,
        })
    }

    const chooseTarget = (choice: string) => {
        moves.chooseTarget({
            target: G.c.players[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID,
            targetName: getName(G.c.players[parseInt(choice)])
        })
    }

    const chooseRegion = (choice: string) => {
        moves.chooseRegion({
            r: G.e.regions[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID,
        })
    }
    const chooseEffect = (choice: string) => {
        moves.chooseEffect({
            effect: G.e.choices[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID
        })
    }
    const chooseEvent = (choice: string) => {
        moves.chooseEvent({
            event: G.events[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID,
        })
    }
    const competitionCard = (choice: string) => {
        moves.competitionCard({
            pass: false,
            card: hand[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID
        })
    }

    const requestEndTurn = (choice: string) => {
        if (choice === "yes") {
            moves.requestEndTurn(playerID);
            // if (G.logDiscrepancyWorkaround) {
            //     events?.endTurn?.();
            // }
        }
    }

    const discardChoices = () => {
        if (playerID === null) return [];
        if (G.e.stack.length > 0) {
            let eff = G.e.stack.slice(-1)[0];
            switch (eff.e) {
                case "discard":
                    return G.player[parseInt(playerID)].hand.map((c, idx) => {
                        return {
                            label: getCardName(c),
                            disabled: false,
                            hidden: false,
                            value: idx.toString()
                        }
                    })
                case "discardAesthetics":
                    return G.player[parseInt(playerID)].hand.map((c, idx) => {
                        return {
                            label: getCardName(c),
                            disabled: false,
                            hidden: getCardById(c).aesthetics === 0,
                            value: idx.toString()
                        }
                    })
                case "discardNormalOrLegend":
                    return G.player[parseInt(playerID)].hand.map((c, idx) => {
                        let card = getCardById(c)
                        return {
                            label: getCardName(c),
                            disabled: false,
                            hidden: card.category !== CardCategory.NORMAL && card.category !== CardCategory.LEGEND,
                            value: idx.toString()
                        }
                    })
                case "discardLegend":
                    return G.player[parseInt(playerID)].hand.map((c, idx) => {
                        let card = getCardById(c)
                        return {
                            label: getCardName(c),
                            disabled: false,
                            hidden: card.category !== CardCategory.LEGEND,
                            value: idx.toString()
                        }
                    })
                case "discardIndustry":
                    return G.player[parseInt(playerID)].hand.map((c, idx) => {
                        return {
                            label: getCardName(c),
                            disabled: false,
                            hidden: getCardById(c).industry === 0,
                            value: idx.toString()
                        }
                    })
                case "playedCardInTurnEffect":
                    return G.pub[parseInt(playerID)].playedCardInTurn.map((c, idx) => {
                        return {
                            label: getCardName(c),
                            disabled: false,
                            hidden: getCardById(c).aesthetics === 0,
                            value: idx.toString()
                        }
                    })
                default:
                    return handChoices
            }
        } else {
            return handChoices
        }
    }

    const comment = (slot: ICardSlot, card: BasicCardID | null) => moves.comment({
        target: slot,
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

    const drawCard = (choice: string) => {
        if (choice === "yes") {
            moves.drawCard(playerID);
        }
    };

    const undoFn = () => undo();
    const redoFn = () => redo();
    const endStage = () => events?.endStage?.()
    const endTurn = () => events?.endTurn?.();
    const endPhase = () => events?.endPhase?.()
    const nop = () => {
    }

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
        <>
            <BoardRegion getPlayerName={getName} r={Region.NA} moves={moves} region={G.regions[0]} G={G} ctx={ctx}
                         playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.WE} moves={moves} region={G.regions[1]} G={G} ctx={ctx}
                         playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.EE} moves={moves} region={G.regions[2]} G={G} ctx={ctx}
                         playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.ASIA} moves={moves} region={G.regions[3]} G={G} ctx={ctx}
                         playerID={playerID}/>
        </>
    const inferredDeck = (p: PlayerID): CardID[] => {
        const pub = G.pub[parseInt(p)];
        const playerObj = G.player[parseInt(p)];
        let result = [...G.pub[parseInt(p)].allCards]
        pub.discard.forEach(c => {
            let indexOfDiscard = result.indexOf(c)
            if (indexOfDiscard !== -1) {
                result.splice(indexOfDiscard, 1)
            }
        })
        pub.archive.forEach(c => {
            let indexOfArchive = result.indexOf(c)
            if (indexOfArchive !== -1) {
                result.splice(indexOfArchive, 1)
            }
        })
        playerObj.hand.forEach(c => {
            let indexOfHand = result.indexOf(c)
            if (indexOfHand !== -1) {
                result.splice(indexOfHand, 1)
            }
        })
        return result;
    }
    const deck = playerID !== null ? inferredDeck(playerID) : [];
    const gameOverResult = ctx.gameover === undefined ? <></> : <Grid item xs={12} sm={6}>
        <Typography variant={"h2"}>{i18n.gameOver.title}</Typography>
        <Typography variant={"h3"}>{getName(ctx.gameover.winner)}</Typography>
    </Grid>
    const operationPanel = playerID !== null ? <Grid item xs={12} sm={6}>
            {canMoveCurrent ?
                <>
                    <Grid item><Typography
                        variant={"h6"}
                        color="inherit"
                    >{i18n.dialog.buyCard.basic}</Typography></Grid>
                    <BuyCard
                        card={BasicCardID.B01} helpers={G.player[parseInt(playerID)].hand}
                        G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                    <BuyCard
                        card={BasicCardID.B02} helpers={G.player[parseInt(playerID)].hand}
                        G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                    <BuyCard
                        card={BasicCardID.B03} helpers={G.player[parseInt(playerID)].hand}
                        G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                    <BuyCard
                        card={BasicCardID.B04} helpers={G.player[parseInt(playerID)].hand}
                        G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                    <BuyCard
                        card={BasicCardID.B05} helpers={G.player[parseInt(playerID)].hand}
                        G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                </> : <></>
            }
            {activePlayer(ctx) === playerID ? <Button
                variant={"outlined"}
                onClick={undoFn}
            >{i18n.action.undo}</Button> : <></>}
            {activePlayer(ctx) === playerID ? <Button
                variant={"outlined"}
                onClick={redoFn}
            >{i18n.action.redo}</Button> : <></>}
            {G.pending.endTurn && canMoveCurrent ? <Button
                    variant={"outlined"}
                    onClick={endTurn}
                >{i18n.action.endTurn}</Button>
                : <></>}
            {G.pending.endStage && canMoveCurrent ? <Button
                    variant={"outlined"}
                    onClick={endStage}
                >{i18n.action.endStage}</Button>
                : <></>}
            {ctx.phase !== "InitPhase" && canMoveCurrent ?
                <ChoiceDialog
                    initial={false}
                    callback={drawCard}
                    choices={[
                        {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                        {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
                    ]} defaultChoice={"yes"}
                    show={
                        G.pub[parseInt(playerID)].action > 0
                        && !G.player[parseInt(playerID)].deckEmpty
                        && !G.pending.endTurn
                    }
                    title={i18n.action.draw} toggleText={i18n.action.draw}
                />
                : <></>}
            <ChoiceDialog
                initial={false}
                callback={requestEndTurn}
                choices={[
                    {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                    {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
                ]} defaultChoice={"yes"}
                show={playerID !== null && canMoveCurrent && !G.pending.endTurn}
                title={i18n.action.endStage} toggleText={i18n.action.endStage}
            />
            <ChoiceDialog
                initial={true}
                callback={peek}
                choices={
                    G.player[parseInt(playerID)].cardsToPeek
                        .map(r => {
                            return {
                                label: getCardName(r),
                                value: r,
                                hidden: false,
                                disabled: peekChoicesDisabled
                            }
                        })
                } defaultChoice={"0"} show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "peek"}
                title={i18n.dialog.peek.title}
                toggleText={i18n.dialog.peek.title}/>
            <ChoiceDialog
                initial={true}
                callback={chooseRegion}
                choices={
                    G.e.regions
                        .map((r, idx) => {
                            return {
                                label: i18n.region[r],
                                value: idx.toString(),
                                hidden: false, disabled: false
                            }
                        })
                } defaultChoice={"4"} show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "chooseRegion"}
                title={i18n.dialog.chooseRegion.title}
                toggleText={i18n.dialog.chooseRegion.toggleText}/>
            <ChoiceDialog
                initial={true}
                callback={chooseTarget}
                choices={
                    G.c.players.map((pid, idx) => {
                        return {
                            label: getName(pid.toString()),
                            value: idx.toString(),
                            hidden: false, disabled: false
                        }
                    })
                } defaultChoice={'0'} show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "chooseTarget"}
                title={i18n.dialog.chooseTarget.title}
                toggleText={i18n.dialog.chooseTarget.toggleText}/>
            <ChoiceDialog
                callback={chooseEvent}
                choices={G.events.map((c, idx) => {
                    return {
                        label: getCardName(c) + i18n.eventName[c],
                        disabled: false,
                        hidden: false,
                        value: idx.toString()
                    }
                })} defaultChoice={"0"}
                show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "chooseEvent"}
                title={i18n.dialog.chooseEvent.title} toggleText={i18n.dialog.chooseEvent.toggleText}
                initial={true}/>
            <ChoiceDialog
                callback={competitionCard}
                choices={handChoices}
                defaultChoice={'0'}
                show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "competitionCard"}
                title={i18n.dialog.competitionCard.title}
                toggleText={i18n.dialog.competitionCard.toggleText}
                initial={true}/>

            <ChoiceDialog
                callback={chooseHand}
                choices={discardChoices()} defaultChoice={"0"}
                show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "chooseHand"}
                title={i18n.dialog.chooseHand.title} toggleText={i18n.dialog.chooseHand.toggleText}
                initial={true}/>

            <ChoiceDialog
                callback={chooseEffect}
                choices={G.e.choices.map((c, idx) => {
                    return {
                        label: effName(c),
                        disabled: false,
                        hidden: false,
                        value: idx.toString()
                    }
                })} defaultChoice={"0"}
                show={playerID !== null && activePlayer(ctx) === playerID && actualStage(G, ctx) === "chooseEffect"}
                title={i18n.dialog.chooseEffect.title} toggleText={i18n.dialog.chooseEffect.toggleText}
                initial={true}/>
            <ChoiceDialog
                callback={moves.confirmRespond}
                choices={[
                    {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                    {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
                ]} defaultChoice={"no"}
                show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "confirmRespond"}
                title={effName(G.e.currentEffect)}
                toggleText={i18n.dialog.confirmRespond.title}
                initial={true}/>
            <ChoiceDialog
                callback={nop}
                choices={deck.map((c, idx) => {
                    return {
                        label: getCardName(c),
                        disabled: true,
                        hidden: false,
                        value: idx.toString(),
                    }
                })}
                show={true}
                initial={false}
                title={i18n.pub.deck}
                toggleText={`i18n.pub.deck(${deck.length})`}
                defaultChoice={'0'}/>
        </Grid>
        : <></>


    return <Grid container justify="space-evenly" alignItems="center">
        {ctx.numPlayers !== SimpleRuleNumPlayers ? <Grid xs={12} spacing={2} container item>
            <Grid item xs={4}><Typography>{i18n.pub.events}</Typography></Grid>
            {G.events.map((e, idx) => <Grid key={idx} item xs={4}>
                <Paper key={idx} elevation={10}>
                    <Typography>{getCardName(e)}</Typography>
                </Paper></Grid>)}
        </Grid> : <></>}

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
        {G.pub.map((u, idx) => <Grid container item key={idx} xs={12}>
            <Grid item xs={4} sm={3} md={2} lg={1}><Typography>{getName(idx.toString())}</Typography></Grid>
            <Grid item xs={4} sm={3} md={2} lg={1}><Typography>{i18n.pub.handSize} {G.player[idx].handSize}</Typography></Grid>
            <PubPanel G={G} i={u}/>
        </Grid>)}
        {gameOverResult}
        {operationPanel}
        {playerID !== null && ctx.gameover === undefined ?
            <PlayerHand moves={moves} G={G} playerID={playerID} ctx={ctx}/> : <></>}
        {log === undefined ? <></> : <LogView log={log} getPlayerName={getName}/>}
        <Typography>{plugins.random.data.seed}</Typography>
    </Grid>
}

import React from "react";
import {BoardProps} from "boardgame.io/react";
import {IG, privatePlayer} from "../types/setup";
import {BoardCardSlot, BoardRegion} from "./region";
import {PlayerHand} from "./playerHand";
import {ChoiceDialog} from "./modals";
import {activePlayer, actualStage, effName, studioInRegion} from "../game/util";
import i18n from "../constant/i18n";
import {PlayerID} from "boardgame.io";
import Button from "@material-ui/core/Button";
import {PubPanel} from "./pub";
import {BasicCardID, CardCategory, EventCardID, IBasicCard, ICardSlot, Region, ValidRegions} from "../types/core";
import {BuyCard} from "./buyCard";
import {B01, B02, B03, B05} from "../constant/cards/basic";
import {Grid, Paper, Typography} from "@material-ui/core";
import {CardList} from "./cardreference";


export const FilmCentenaryBoard = ({G, ctx, events, moves, undo, redo, isActive, matchData, playerID}: BoardProps<IG>) => {

    const canMoveCurrent = ctx.currentPlayer === playerID && ctx.activePlayers === null;
    const canMoveOutOfTurn = ctx.currentPlayer !== playerID && activePlayer(ctx) === playerID;
    const canMove = ctx.currentPlayer === playerID ? canMoveCurrent : canMoveOutOfTurn;
    const getName = (playerID: PlayerID | null): string => {
        const fallbackName = i18n.playerName.player + playerID;
        if (playerID === null) {
            return i18n.playerName.spectator
        } else {
            if (matchData === undefined) {
                return fallbackName;
            } else {
                let arr = matchData.filter(m => m.id.toString() === playerID)
                if (arr.length === 0) {
                    return fallbackName;
                } else {
                    return arr[0].name === undefined ? fallbackName : arr[0].name;
                }
            }
        }
    }
    const iPrivateInfo = playerID === null ? privatePlayer():G.player[parseInt(playerID)];
    const hand = playerID === null ? [] : iPrivateInfo.hand
    const handChoices = playerID === null ? [] : hand.map((c, idx) => {
        return {
            // @ts-ignore
            label: i18n.card[c.cardId],
            disabled: false,
            hidden: false,
            value: idx.toString()
        }
    })

    const peek = (choice:string)=>{
        moves.peek({
            idx:parseInt(choice),
            card:iPrivateInfo.cardsToPeek[parseInt(choice)],
            p:playerID,
        })
    }

    const chooseHand = (choice:string) =>{
        moves.chooseHand({
            hand:hand[parseInt(choice)],
            idx:parseInt(choice),
            p:playerID,
        })
    }
    const chooseTarget = (choice:string) =>{
        moves.chooseTarget({
            event:G.events[parseInt(choice)],
            idx:parseInt(choice),
            p:playerID,
        })
    }

    const chooseRegion = (choice:string) =>{
        moves.chooseRegion({
            r:G.e.regions[parseInt(choice)],
            idx:parseInt(choice),
            p:playerID,
        })
    }
    const chooseEffect = (choice:string) =>{
        moves.chooseEffect({
            effect:G.e.choices[parseInt(choice)],
            idx:parseInt(choice),
            p:playerID
        })
    }
    const chooseEvent = (choice:string) =>{
        moves.chooseEvent({
            event:G.events[parseInt(choice)],
            idx:parseInt(choice),
            p:playerID,
        })
    }
    const competitionCard = (choice:string) =>{
        moves.competitionCard({
            pass:false,
            card:hand[parseInt(choice)],
            idx:parseInt(choice),
            p:playerID
        })
    }
    const discardChoices = () => {
        if (playerID === null) return [];
        if (G.e.stack.length > 0) {
            let eff = G.e.stack.slice(-1)[0];
            switch (eff.e) {
                case "discard":
                    return G.player[parseInt(playerID)].hand.map((c, idx) => {
                        return {
                            // @ts-ignore
                            label: i18n.card[c.cardId],
                            disabled: false,
                            hidden: false,
                            value: idx.toString()
                        }
                    })
                case "discardAesthetics":
                    return G.player[parseInt(playerID)].hand.map((c, idx) => {
                        return {
                            // @ts-ignore
                            label: i18n.card[c.cardId],
                            disabled: false,
                            // @ts-ignore
                            hidden: c.aesthetics === 0,
                            value: idx.toString()
                        }
                    })
                case "discardNormalOrLegend":
                    return G.player[parseInt(playerID)].hand.map((c, idx) => {
                        return {
                            // @ts-ignore
                            label: i18n.card[c.cardId],
                            disabled: false,
                            hidden: c.category !== CardCategory.NORMAL && c.category !== CardCategory.LEGEND,
                            value: idx.toString()
                        }
                    })
                case "discardLegend":
                    return G.player[parseInt(playerID)].hand.map((c, idx) => {
                        return {
                            // @ts-ignore
                            label: i18n.card[c.cardId],
                            disabled: false,
                            hidden: c.category !== CardCategory.LEGEND,
                            value: idx.toString()
                        }
                    })
                case "discardIndustry":
                    return G.player[parseInt(playerID)].hand.map((c, idx) => {
                        return {
                            // @ts-ignore
                            label: i18n.card[c.cardId],
                            disabled: false,
                            // @ts-ignore
                            hidden: c.industry === 0,
                            value: idx.toString()
                        }
                    })
                case "playedCardInTurnEffect":
                    return G.pub[parseInt(playerID)].playedCardInTurn.map((c, idx) => {
                        return {
                            // @ts-ignore
                            label: i18n.card[c.cardId],
                            disabled: false,
                            // @ts-ignore
                            hidden: c.aesthetics === 0,
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

    const comment = (slot: ICardSlot, card: IBasicCard | null) => moves.comment(G, ctx, {target: slot, comment: card})

    const cardBoard = ctx.numPlayers === 2 ?
        <Grid container spacing={2} alignItems="center">
            <Grid item xs={12}><Typography>{i18n.pub.share}</Typography></Grid>
            {ValidRegions.map(r => <Grid
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
            <BoardRegion getPlayerName={getName} r={Region.NA} moves={moves} region={G.regions[0]} G={G} ctx={ctx} playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.WE} moves={moves} region={G.regions[1]} G={G} ctx={ctx} playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.EE} moves={moves} region={G.regions[2]} G={G} ctx={ctx} playerID={playerID}/>
            <BoardRegion getPlayerName={getName} r={Region.ASIA} moves={moves} region={G.regions[3]} G={G} ctx={ctx} playerID={playerID}/>
        </>

    return <Grid container justify="space-evenly" alignItems="center">
        <Grid xs={12} spacing={2} container item
        >
            <Grid item xs={4}><Typography>{i18n.pub.events}</Typography></Grid>
            {ctx.numPlayers !== 2 ? G.events.map((e, idx) => <Grid key={idx} item xs={4}>
                <Paper key={idx} elevation={10}>
                    <Typography>{i18n.card[e.cardId as EventCardID]}</Typography>
                </Paper></Grid>) : <></>}
        </Grid>
        <CardList/>
        {ctx.phase === "InitPhase" ?
            <Grid item>
                <Button fullWidth={true}
                        disabled={!canMove}
                        onClick={() => moves.initialSetup({...G.regions})}>
                    {i18n.action.initialSetup}
                </Button> </Grid> : cardBoard
        }

        {G.pub.map((u, idx) => <Grid container item key={idx} xs={12}>
            <Grid item xs={4} sm={3} md={2} lg={1}><Typography>{getName(idx.toString())}</Typography></Grid>
            <Grid item xs={4} sm={3} md={2} lg={1}><Typography>{i18n.pub.handSize} {G.player[idx].handSize}</Typography></Grid>
            <PubPanel key={idx} {...u}/>
        </Grid>)}
        <Grid item xs={12} sm={6}>
            {playerID !== null && canMoveCurrent ?
                <>
                    <Grid item><Typography
                        variant={"h6"}
                        color="inherit"
                    >{i18n.dialog.buyCard.basic}</Typography></Grid>
                    <BuyCard
                        card={B01} helpers={G.player[parseInt(playerID)].hand}
                        G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                    <BuyCard
                        card={B02} helpers={G.player[parseInt(playerID)].hand}
                        G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                    <BuyCard
                        card={B03} helpers={G.player[parseInt(playerID)].hand}
                        G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                    <BuyCard
                        card={B05} helpers={G.player[parseInt(playerID)].hand}
                        G={G} playerID={playerID} ctx={ctx} moves={moves}/>

                </> : <></>
            }

            {isActive ? <Button
                variant={"outlined"}
                onClick={() => undo()}
            >{i18n.action.undo}</Button> : <></>}
            {isActive ? <Button
                variant={"outlined"}
                onClick={() => redo()}
            >{i18n.action.redo}</Button> : <></>}
            {G.pending.endPhase && canMoveCurrent ? <Button
                    variant={"outlined"}
                    onClick={() => events?.endPhase?.()}
                >{i18n.action.endPhase}</Button>
                : <></>}
            {G.pending.endTurn && canMoveCurrent ? <Button
                    variant={"outlined"}
                    onClick={() => events?.endTurn?.()}
                >{i18n.action.endTurn}</Button>
                : <></>}
            {G.pending.endStage && canMoveCurrent ? <Button
                    variant={"outlined"}
                    onClick={() => events?.endStage?.()}
                >{i18n.action.endStage}</Button>
                : <></>}
            {playerID !== null && canMoveCurrent ?
                <>
                    <Button
                        disabled={G.pub[parseInt(playerID)].action <= 0}
                        variant={"outlined"}
                        onClick={() => moves.drawCard()}>
                        {i18n.action.draw}
                    </Button> </> : <></>}
            {playerID !== null && G.pub[parseInt(playerID)].action <= 0 ?
                <Button
                    onClick={() => moves.requestEndTurn(playerID)}>
                    {i18n.action.endStage}
                </Button> : <></>}
            {playerID !== null ? <ChoiceDialog
                initial={true}
                callback={peek}
                choices={
                    G.player[parseInt(playerID)].cardsToPeek
                        .map(r => {
                            return {
                                label: i18n.card[r.cardId as BasicCardID],
                                value: r.cardId,
                                hidden: false, disabled: true
                            }
                        })
                } defaultChoice={"0"} show={isActive && actualStage(G, ctx) === "peek"}
                title={i18n.dialog.peek.title}
                toggleText={i18n.dialog.peek.title}/> : <></>}
            <ChoiceDialog
                initial={true}
                callback={chooseRegion}
                choices={
                    G.e.regions
                        .map(r => {
                            return {
                                label: i18n.region[r],
                                value: r.toString(),
                                hidden: false, disabled: false
                            }
                        })
                } defaultChoice={"4"} show={isActive && actualStage(G, ctx) === "chooseRegion"}
                title={i18n.dialog.chooseRegion.title}
                toggleText={i18n.dialog.chooseRegion.toggleText}/>
            <ChoiceDialog
                initial={true}
                callback={chooseTarget}
                choices={
                    Array(ctx.numPlayers)
                        .fill(1)
                        .map((i, idx) => idx)
                        .filter(p => !studioInRegion(G, ctx, G.e.card.region, p.toString()))
                        .map(pid => {
                            return {
                                label: getName(pid.toString()),
                                value: pid.toString(),
                                hidden: false, disabled: false
                            }
                        })
                } defaultChoice={'0'} show={isActive && actualStage(G, ctx) === "chooseTarget"}
                title={i18n.dialog.chooseTarget.title}
                toggleText={i18n.dialog.chooseTarget.toggleText}/>

            {playerID !== null ?
                <ChoiceDialog
                    callback={chooseEvent}
                    choices={G.events.map((c, idx) => {
                        return {
                            // @ts-ignore
                            label: i18n.card[c.cardId],
                            disabled: false,
                            hidden: false,
                            value: idx.toString()
                        }
                    })} defaultChoice={"0"}
                    show={isActive && actualStage(G, ctx) === "chooseEvent"}
                    title={i18n.dialog.chooseEvent.title} toggleText={i18n.dialog.chooseEvent.toggleText}
                    initial={true}/> : <></>}
            <ChoiceDialog
                callback={competitionCard}
                choices={handChoices}
                defaultChoice={'0'}
                show={playerID!==null && actualStage(G,ctx)==="competitionCard"}
                title={i18n.dialog.chooseHand.title}
                toggleText={i18n.dialog.chooseHand.toggleText}
                initial={true}/>
            {playerID !== null ?
            <ChoiceDialog
                callback={chooseHand}
                choices={discardChoices()} defaultChoice={"0"}
                show={isActive && actualStage(G, ctx) === "chooseHand"}
                title={i18n.dialog.chooseHand.title} toggleText={i18n.dialog.chooseHand.toggleText}
                initial={true}/> : <></>}
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
                show={playerID!== null && isActive && actualStage(G, ctx) === "chooseEffect"}
                title={i18n.dialog.chooseEffect.title} toggleText={i18n.dialog.chooseEffect.toggleText}
                initial={true}/>
            <ChoiceDialog
                callback={moves.confirmRespond}
                choices={[
                    {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                    {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
                ]} defaultChoice={"no"}
                show={isActive && actualStage(G, ctx) === "confirmRespond"}
                title={i18n.dialog.confirmRespond.title} toggleText={i18n.dialog.confirmRespond.toggleText}
                initial={true}/>
        </Grid>
        {playerID !== null ? <PlayerHand moves={moves} G={G} playerID={playerID} ctx={ctx}/> : <></>}
    </Grid>
}

import React from "react";
import {BoardProps} from "boardgame.io/react";
import {IG} from "../types/setup";
import {BoardRegion} from "./region";
import {PlayerHand} from "./playerHand";
import {ChoiceDialog} from "./modals";
import {activePlayer, actualStage, studioInRegion} from "../game/util";
import i18n from "../constant/i18n";
import {PlayerID} from "boardgame.io";
import Button from "@material-ui/core/Button";
import {PubPanel} from "./pub";
import {BasicCardID, Region} from "../types/core";


export const FilmCentenaryBoard = ({G, ctx, events, moves, isActive, matchData, playerID}: BoardProps<IG>) => {

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
    const cards: BasicCardID[] = [BasicCardID.B01, BasicCardID.B02, BasicCardID.B03, BasicCardID.B05];
    const buy = (cardId: string) => moves.buyCard(G, ctx, {
        buyer: playerID,
        target: cardId,
        resource: 0,
        cash: 0,
        helper: [],
    });

    return <div>
        {ctx.phase === "InitPhase" ?
            <Button
                disabled={!canMove}
                onClick={() => moves.initialSetup({...G.regions})}>
                {i18n.action.initialSetup}
            </Button> :
            <>
                <BoardRegion r={Region.NA} moves={moves} region={G.regions[0]} G={G} ctx={ctx} playerID={playerID}/>
                <BoardRegion r={Region.WE} moves={moves} region={G.regions[1]} G={G} ctx={ctx} playerID={playerID}/>
                <BoardRegion r={Region.EE} moves={moves} region={G.regions[2]} G={G} ctx={ctx} playerID={playerID}/>
                <BoardRegion r={Region.ASIA} moves={moves} region={G.regions[3]} G={G} ctx={ctx} playerID={playerID}/>
            </>}
        {G.pub.map((u, idx) => <PubPanel key={idx} {...u}/>)}
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
        <ChoiceDialog
            initial={false}
            callback={buy}
            choices={cards.map(
                id => {
                    return {
                        label: i18n.card[id],
                        disabled: G.basicCards[id] === 0,
                        hidden: false,
                        value: id
                    }
                }
            )}
            defaultChoice={"B01"} show={ctx.currentPlayer === playerID}
            title={i18n.dialog.buyCard.basic} toggleText={i18n.dialog.buyCard.basic}/>

        {playerID !== null && canMoveCurrent ?
            <Button
                disabled={G.pub[parseInt(playerID)].action === 0}
                variant={"outlined"}
                onClick={() => moves.drawCard()}>
                {i18n.action.draw}
            </Button> : <></>}
        <ChoiceDialog
            initial={true}
            callback={moves.chooseTarget}
            choices={
                Array(G.playerCount)
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
            title={i18n.dialog.choosePlayer.title}
            toggleText={i18n.dialog.choosePlayer.toggleText}/>
        <ChoiceDialog
            callback={moves.chooseEffect}
            choices={G.e.choices.map((c,idx)=>{
                return {
                // @ts-ignore
                label: i18n.effect[c.e],
                disabled: false,
                hidden: false,
                value: idx.toString()
            }})} defaultChoice={"0"}
            show={isActive && actualStage(G,ctx)==="chooseEffect"}
            title={i18n.dialog.chooseEffect.title} toggleText={i18n.dialog.chooseEffect.toggleText}
            initial={true}/>
        <ChoiceDialog
            callback={moves.confirmRespond}
            choices={[
                {label:i18n.dialog.confirmRespond.yes,value:"yes",disabled:false,hidden:false},
                {label:i18n.dialog.confirmRespond.no,value:"no",disabled:false,hidden:false}
            ]} defaultChoice={"no"}
            show={isActive && actualStage(G,ctx)==="confirmRespond"}
            title={i18n.dialog.confirmRespond.title} toggleText={i18n.dialog.confirmRespond.toggleText}
            initial={true}/>

        {playerID !== null ? <PlayerHand moves={moves} G={G} playerID={playerID} ctx={ctx}/> : ""}
    </div>
}

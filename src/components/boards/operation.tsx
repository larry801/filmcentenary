import React from "react";
import {IG} from "../../types/setup";
import {Ctx, PlayerID} from "boardgame.io";
import i18n from "../../constant/i18n";
import {BuyCard} from "../buyCard";
import Grid from "@material-ui/core/Grid"
import {ChoiceDialog} from "../modals";
import Typography from "@material-ui/core/Typography";
import {BasicCardID, CardCategory, CardID} from "../../types/core";
import {activePlayer, actualStage, effName, getCardName, inferDeckRemoveHelper} from "../../game/util";
import Button from "@material-ui/core/Button";
import {getCardById} from "../../types/cards";
import {PlayerHand} from "../playerHand";
import {Stage} from "boardgame.io/core";
import Slider from "@material-ui/core/Slider";

export interface IOPanelProps {
    G: IG,
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>,
    playerID: PlayerID,
    events: {
        endGame?: (gameover?: any) => void;
        endPhase?: () => void;
        endTurn?: (arg?: { next: PlayerID }) => void;
        setPhase?: (newPhase: string) => void;
        endStage?: () => void;
        setStage?: (newStage: string) => void;
    },
    undo: () => void;
    redo: () => void;
    getName: (pid: string) => string,
}

export const OperationPanel = ({G, getName, ctx, playerID, moves, undo, redo, events}: IOPanelProps) => {
    const pub = G.pub[parseInt(playerID)];
    const iPrivateInfo = G.player[parseInt(playerID)];
    const hand =  iPrivateInfo.hand
    const stage = actualStage(G,ctx);
    const noStage = stage === Stage.NULL;

    const inferredDeck = (p: PlayerID): CardID[] => {
        const pub = G.pub[parseInt(p)];
        const playerObj = G.player[parseInt(p)];
        let result = [...G.pub[parseInt(p)].allCards]
        inferDeckRemoveHelper(result,pub.discard);
        inferDeckRemoveHelper(result,pub.archive);
        inferDeckRemoveHelper(result,playerObj.hand);
        // TODO remove any school card
        return result;
    }

    const deck = playerID !== null ? inferredDeck(playerID) : [];

    const canMoveCurrent = ctx.currentPlayer === playerID && activePlayer(ctx) === playerID;

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

    const drawCard = (choice: string) => {
        if (choice === "yes") {
            moves.drawCard(playerID);
        }
    };
    const showCompetitionResult = () =>{
        moves.showCompetitionResult({info: {...G.competitionInfo}})
    }

    const [depositExtra, setDepositExtra] = React.useState(0);
    const handleSliderChange = (event: any, newValue: number | number[]) => {
        if (typeof newValue === "number") {
            setDepositExtra(newValue);
        }
    };
    const extraCost = G.e.extraCostToPay;
    const minDeposit = Math.max(extraCost - pub.resource, 0);
    const deposit = depositExtra + minDeposit
    const maxDeposit = Math.min(extraCost, pub.deposit);
    const getValueText = (n: number) => n.toString();
    const payAdditionalCost = () => {
        moves.payAdditionalCost({
            res: extraCost - deposit,
            deposit: deposit,
        })
    }
    const sliderPart = stage  === "payAdditionalCost"? <Grid item xs={6}>
            <Slider
                onChange={handleSliderChange}
                min={0}
                max={maxDeposit - minDeposit}
                step={1}
                marks
                getAriaValueText={getValueText}
                aria-labelledby="extraCost-deposit-slider"
                valueLabelDisplay="auto"
                value={depositExtra}
            />
        <Button
            variant="contained"
            color="primary"
            onClick={payAdditionalCost}>
            {i18n.action.payAdditionalCost}
            {i18n.pub.res}{extraCost - deposit}
            {i18n.pub.deposit}{deposit}
        </Button>
        </Grid>:
        <></>

    const undoFn = () => undo();
    const redoFn = () => redo();
    const endStage = () => events?.endStage?.();
    const endTurn = () => events?.endTurn?.();
    const nop = () => {
    };

    return <Grid item container xs={12} sm={5}>
            {noStage?
            <Grid item xs={6}>
                <Typography
                    variant={"h6"}
                    color="inherit"
                >{i18n.dialog.buyCard.basic}</Typography>
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
            </Grid>:<></>}
            {sliderPart}
            <Grid item xs={6}>
                {activePlayer(ctx) === playerID ? <Button
                    fullWidth
                    variant={"outlined"}
                    onClick={undoFn}
                >{i18n.action.undo}</Button> : <></>}
                {activePlayer(ctx) === playerID ? <Button
                    fullWidth
                    variant={"outlined"}
                    onClick={redoFn}
                >{i18n.action.redo}</Button> : <></>}
                {G.pending.endTurn && canMoveCurrent ? <Button
                        fullWidth
                        variant={"outlined"}
                        onClick={endTurn}
                    >{i18n.action.endTurn}</Button>
                    : <></>}
                {G.pending.endStage && canMoveCurrent
                    ? <Button
                        fullWidth
                        variant={"outlined"}
                        onClick={endStage}
                    >{i18n.action.endStage}</Button>
                    : <></>}

                {canMoveCurrent && actualStage(G,ctx) === "showCompetitionResult"
                    ? <Button
                        fullWidth
                        variant={"outlined"}
                        onClick={showCompetitionResult}
                    >{i18n.action.showCompetitionResult}</Button>
                    : <></>}
                {canMoveCurrent ?
                    <ChoiceDialog
                        initial={false}
                        callback={drawCard}
                        popAfterShow={false}
                        choices={[
                            {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                            {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
                        ]} defaultChoice={"yes"}
                        show={
                            G.pub[parseInt(playerID)].action > 0
                            && !G.player[parseInt(playerID)].deckEmpty
                            && !G.pending.endTurn
                            && noStage
                        }
                        title={i18n.action.draw} toggleText={i18n.action.draw}
                    />
                    : <></>}
                <ChoiceDialog
                    initial={false}
                    callback={requestEndTurn}
                    popAfterShow={false}
                    choices={[
                        {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                        {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
                    ]} defaultChoice={"yes"}
                    show={canMoveCurrent && !G.pending.endTurn &&noStage}
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
                    } defaultChoice={"4"}
                    show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "chooseRegion"}
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
                    } defaultChoice={'0'}
                    show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "chooseTarget"}
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
                    show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "chooseEffect"}
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
                    toggleText={`${i18n.pub.deck}(${deck.length})`}
                    defaultChoice={'0'}/>
            </Grid>
            <Grid item xs={12}>
                <PlayerHand moves={moves} G={G} playerID={playerID} ctx={ctx}/>
            </Grid>
        </Grid>
}

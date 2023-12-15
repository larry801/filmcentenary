import React from "react";
import NextTurnIcon from '@material-ui/icons/ExitToApp';
import DeckIcon from '@material-ui/icons/Layers';
import {IG} from "../../types/setup";
import {Ctx, LogEntry, PlayerID} from "boardgame.io";
import i18n from "../../constant/i18n";
import BuyCard from "../buy-card";
import Grid from "@material-ui/core/Grid"
import ChoiceDialog from "../modals";
import Typography from "@material-ui/core/Typography";
import {BasicCardID, CardID, ClassicFilmAutoMoveMode, getCardById} from "../../types/core";
import {activePlayer, actualStage} from "../../game/util";
import Button from "@material-ui/core/Button";
import ButtonGroup from "@material-ui/core/ButtonGroup";
import {PlayerHand} from "../player-hand";
import {Stage} from "boardgame.io/core";
import Slider from "@material-ui/core/Slider";
import {PubPanel} from "../pub";
import {getChooseHandChoice, getValidHelper, inferDeckRemoveHelper} from "../../game/board-util";
import {effName, getCardName} from "../card";
import UndoIcon from '@material-ui/icons/Undo';
import RedoIcon from '@material-ui/icons/Redo';
import IconButton from "@material-ui/core/IconButton";
import {ActionPointIcon} from "../icons";
import HandIcon from "@material-ui/icons/PanTool";
import ConcedeIcon from '@material-ui/icons/DirectionsRun';
import CardList from "./list-card";


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
    log: LogEntry[],
}

export const OperationPanel = ({G, getName, ctx, playerID, moves, undo, redo, events, log}: IOPanelProps) => {
    const pub = G.pub[parseInt(playerID)];
    const iPrivateInfo = G.player[parseInt(playerID)];
    const hand = iPrivateInfo.hand
    const stage = actualStage(G, ctx);
    const noStage = stage === Stage.NULL;

    const inferredDeck = (p: PlayerID): CardID[] => {
        const pub = G.pub[parseInt(p)];
        const playerObj = G.player[parseInt(p)];
        const result = [...G.pub[parseInt(p)].allCards]
        inferDeckRemoveHelper(result, pub.discard);
        inferDeckRemoveHelper(result, pub.archive);
        inferDeckRemoveHelper(result, pub.playedCardInTurn);
        inferDeckRemoveHelper(result, playerObj.hand);
        if (pub.school !== null) {
            let sIndex = result.indexOf(pub.school)
            if (sIndex !== -1) {
                result.splice(sIndex, 1);
            }
        }
        return result;
    }

    const classicFilmButtonGroup = <ButtonGroup aria-label="outlined secondary button group">
        {
            [
                ClassicFilmAutoMoveMode.NO_AUTO,
                ClassicFilmAutoMoveMode.DRAW_CARD,
                ClassicFilmAutoMoveMode.AESTHETICS_AWARD
            ].map(autoMove =>
                <Button
                    style={{textTransform: 'none'}}
                    key={autoMove}
                    disabled={iPrivateInfo.classicFilmAutoMove === autoMove}
                    variant="contained" color="primary"
                    onClick={() => {
                        console.log(JSON.stringify(iPrivateInfo));
                        console.log(iPrivateInfo.classicFilmAutoMove);
                        moves.changePlayerSetting({
                            classicFilmAutoMoveMode: autoMove
                        });
                    }}
                >
                    {i18n.classicFilmAutoMove[autoMove]}
                </Button>)
        }
    </ButtonGroup>;

    const deck = playerID !== null ? inferredDeck(playerID) : [];
    const deckDialog =
        <CardList
            cards={deck}
            label={
                <Typography>
                    <DeckIcon/>{deck.length}
                </Typography>}
            title={
                `${playerID}|${i18n.pub.deck}(${deck.length})`
            }/>


    const canMove = activePlayer(ctx) === playerID;
    const canMoveCurrent = ctx.currentPlayer === playerID && activePlayer(ctx) === playerID;

    const handChoices = getChooseHandChoice(G, playerID, getCardName);

    const hasCurEffect = G.e.stack.length > 0;
    // const effType = hasCurEffect ? G.e.stack.slice(-1)[0] : "";
    const curEffName = hasCurEffect ? effName(G.e.stack.slice(-1)[0]) : "";
    const peekChoicesDisabled = hasCurEffect && G.e.stack[0].e === "peek" ? G.e.stack[0].a.filter.e !== "choice" : true;

    const peekCardLength = iPrivateInfo.cardsToPeek.length.toString();
    const peekChoices = G.player[parseInt(playerID)].cardsToPeek
        .map((r: CardID, idx: number) => {
            return {
                label: getCardName(r),
                value: peekChoicesDisabled ? (idx + 1).toString() : idx.toString(),
                hidden: false,
                disabled: peekChoicesDisabled
            }
        });
    const peekDialogDefaultChoice = peekChoicesDisabled ? peekCardLength : "0";
    const peekNoChoiceChoices = [{
        label: " ",
        value: "0",
        hidden: false,
        disabled: false,
    }, ...peekChoices];
    const peekDialogChoices = peekChoicesDisabled ? peekNoChoiceChoices : peekChoices;
    const peekDialogTitle = peekChoicesDisabled ? i18n.dialog.peek.title : i18n.dialog.peek.choice;
    const peek = (choice: string) => {
        const cardChoice = peekChoicesDisabled ? null : iPrivateInfo.cardsToPeek[parseInt(choice)];
        moves.peek({
            idx: parseInt(choice),
            card: cardChoice,
            p: playerID,
            shownCards: iPrivateInfo.cardsToPeek,
        })
    }
    const peekDialog =
        <ChoiceDialog
            initial={true}
            callback={peek}
            choices={peekDialogChoices}
            defaultChoice={peekDialogDefaultChoice}
            show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "peek"}
            title={peekDialogTitle}
            toggleText={i18n.dialog.peek.title}/>

    const showDrawnButton = <Button
        onClick={() => moves.showDrawn()}
    >

    </Button>

    const discardChoices = getChooseHandChoice(G, playerID, getCardName);
    const chooseHandTitle = hasCurEffect ? curEffName : i18n.dialog.chooseHand.title;
    const chooseHand = (choice: string) => {
        moves.chooseHand({
            hand: hand[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID,
        })
    }
    const chooseHandDialog =
        <ChoiceDialog
            callback={chooseHand}
            choices={discardChoices} defaultChoice={"0"}
            show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "chooseHand"}
            title={chooseHandTitle}
            toggleText={i18n.dialog.chooseHand.toggleText}
            initial={true}/>

    const confirmRespond = (choice: string) => {
        moves.confirmRespond(choice);
    }
    const confirmRespondDialog =
        <ChoiceDialog
            callback={confirmRespond}
            choices={[
                {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
            ]} defaultChoice={"no"}
            show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "confirmRespond"}
            title={effName(G.e.currentEffect)}
            toggleText={i18n.dialog.confirmRespond.title}
            initial={true}/>


    const chooseTarget = (choice: string) => {
        moves.chooseTarget({
            target: G.c.players[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID,
            targetName: getName(G.c.players[parseInt(choice)])
        })
    }
    const chooseTargetTitle = hasCurEffect ? curEffName : i18n.dialog.chooseTarget.title;
    const chooseTargetDialog =
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
            title={chooseTargetTitle}
            toggleText={i18n.dialog.chooseTarget.toggleText}/>


    const chooseRegion = (choice: string) => {
        moves.chooseRegion({
            r: G.e.regions[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID,
        })
    }
    const chooseRegionTitle = hasCurEffect ? curEffName : i18n.dialog.chooseRegion.title;
    const chooseRegionDialog =
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
            title={chooseRegionTitle}
            toggleText={i18n.dialog.chooseRegion.toggleText}/>


    const chooseEffectTitle = hasCurEffect ? curEffName : i18n.dialog.chooseEffect.title;
    const chooseEffect = (choice: string) => {
        moves.chooseEffect({
            effect: G.e.choices[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID
        })
    }
    const chooseEffectDialog = <ChoiceDialog
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
        title={chooseEffectTitle} toggleText={i18n.dialog.chooseEffect.toggleText}
        initial={true}/>


    const chooseEvent = (choice: string) => {
        moves.chooseEvent({
            event: G.events[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID,
        })
    }
    const chooseEventDialog =
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


    const competitionCard = (choice: string) => {
        moves.competitionCard({
            pass: false,
            card: hand[parseInt(choice)],
            idx: parseInt(choice),
            p: playerID
        })
    }
    const competitionCardDialog = <ChoiceDialog
        callback={competitionCard}
        choices={handChoices}
        defaultChoice={'0'}
        show={activePlayer(ctx) === playerID && actualStage(G, ctx) === "competitionCard"}
        title={i18n.dialog.competitionCard.title}
        toggleText={i18n.dialog.competitionCard.toggleText}
        initial={true}/>

    const requestEndTurn = (choice: string) => {
        if (choice === "yes") {
            moves.requestEndTurn(playerID);
        }
    }
    const requestEndTurnDialog =
        <ChoiceDialog
            initial={false}
            callback={requestEndTurn}
            popAfterShow={false}
            choices={[
                {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
            ]} defaultChoice={"yes"}
            show={canMoveCurrent && !G.pending.endTurn && noStage}
            title={i18n.action.endStage}
            toggleText={<Typography><NextTurnIcon/></Typography>}
        />

    const drawCard = (choice: string) => {
        if (choice === "yes") {
            moves.drawCard(playerID);
        }
    };
    const drawCardDialog = canMoveCurrent ?
        <ChoiceDialog
            initial={false}
            callback={drawCard}
            popAfterShow={false}
            choices={[
                {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
            ]} defaultChoice={"yes"}
            disabled={
                G.player[parseInt(playerID)].deckEmpty
            }
            show={
                G.pub[parseInt(playerID)].action > 0
                && !G.pending.endTurn
                && noStage
            }
            title={i18n.action.draw}
            toggleText={<Typography>
                <ActionPointIcon/>
                <HandIcon/>
            </Typography>}
        />
        : <></>


    const showCompetitionResult = () => {
        moves.showCompetitionResult({info: {...G.competitionInfo}})
    }
    const showCompetitionResultButton =
        canMoveCurrent && actualStage(G, ctx) === "showCompetitionResult"
            ? <Button
                fullWidth
                variant={"outlined"}
                onClick={showCompetitionResult}
            >{i18n.action.showCompetitionResult}</Button>
            : <></>


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
    const sliderPart = stage === "payAdditionalCost" && canMove ? <Grid item xs={6}>
            <Typography>{i18n.action.adjustInSlider}</Typography>
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
        </Grid> :
        <></>

    const undoFn = () => undo();
    const undoButton = !G.disableUndo && activePlayer(ctx) === playerID
        ? <IconButton
            onClick={undoFn}
            aria-label={i18n.action.undo}
        >
            <UndoIcon/>
        </IconButton>
        : <></>


    const redoFn = () => redo();
    const redoButton = !G.disableUndo && activePlayer(ctx) === playerID
        ? <IconButton
            onClick={redoFn}
            aria-label={i18n.action.redo}
        >
            <RedoIcon/>
        </IconButton>
        : <></>

    const endStage = () => events?.endStage?.();
    const endStageButton = G.pending.endStage && canMoveCurrent
        ? <Button
            fullWidth
            variant={"outlined"}
            onClick={endStage}
        >{i18n.action.endStage}</Button>
        : <></>


    const endTurn = () => events?.endTurn?.();
    const endTurnButton = G.pending.endTurn && canMoveCurrent
        ? <Button
            fullWidth
            variant={"outlined"}
            onClick={endTurn}
        >{i18n.action.endTurn}</Button>
        : <></>

    const concede = (choice: string) => {
        if (choice === "yes") {
            moves.concede(playerID);
        }
    }
    const concedeDialog =
        <ChoiceDialog
            buttonColor={true}
            initial={false}
            callback={concede}
            popAfterShow={false}
            choices={[
                {label: i18n.dialog.confirmRespond.yes, value: "yes", disabled: false, hidden: false},
                {label: i18n.dialog.confirmRespond.no, value: "no", disabled: false, hidden: false}
            ]} defaultChoice={"no"}
            show={canMoveCurrent && noStage}
            title={i18n.dialog.concede.title}
            toggleText={<ConcedeIcon/>}
        />

    const helpers = playerID === null ? [] : getValidHelper(G, playerID);

    return <Grid item container xs={12} sm={5} justifyContent="flex-start">
        <Grid item container xs={12}>
            <PubPanel log={log} ctx={ctx} i={G.pub[parseInt(playerID)]} idx={parseInt(playerID)} G={G}
                      getName={getName}/>
        </Grid>
        {noStage && canMoveCurrent ?
            <Grid item xs={6}>
                <Typography
                    variant={"h6"}
                    color="inherit"
                >{i18n.dialog.buyCard.basic}</Typography>
                <BuyCard
                    card={BasicCardID.B01} helpers={helpers}
                    G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                <BuyCard
                    card={BasicCardID.B02} helpers={helpers}
                    G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                <BuyCard
                    card={BasicCardID.B03} helpers={helpers}
                    G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                <BuyCard
                    card={BasicCardID.B04} helpers={helpers}
                    G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                <BuyCard
                    card={BasicCardID.B05} helpers={helpers}
                    G={G} playerID={playerID} ctx={ctx} moves={moves}/>
                {classicFilmButtonGroup}
            </Grid> : <></>}
        {sliderPart}
        <Grid item xs={6}>
            {undoButton}
            {redoButton}
            {endTurnButton}
            {endStageButton}
            {concedeDialog}
            {showCompetitionResultButton}
            {drawCardDialog}
            {requestEndTurnDialog}
            {peekDialog}
            {chooseRegionDialog}
            {chooseTargetDialog}
            {chooseEventDialog}
            {competitionCardDialog}
            {chooseHandDialog}
            {confirmRespondDialog}
            {chooseEffectDialog}
            {deckDialog}
        </Grid>
        <Grid item xs={12}>
            <PlayerHand moves={moves} G={G} playerID={playerID} ctx={ctx}/>
        </Grid>
    </Grid>
}

export default OperationPanel;

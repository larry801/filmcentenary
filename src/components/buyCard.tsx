import React from "react";
import {IG} from "../types/setup";
import {
    BasicCardID,
    CardCategory, CardID,
    IBasicCard,
    ICardSlot,
    INormalOrLegendCard,
    ClassicCardID,
    Region
} from "../types/core";
import {ChoiceDialog} from "./modals";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import Dialog from "@material-ui/core/Dialog";
import FormLabel from "@material-ui/core/FormLabel";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import {getBasicCard} from "../constant/cards/basic";
import {Ctx, PlayerID} from "boardgame.io";
import {canAfford, canBuyCard, cardEffectText, getCardName, resCost} from "../game/util";
import Slider from "@material-ui/core/Slider";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import Button from "@material-ui/core/Button";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import FormGroup from "@material-ui/core/FormGroup";
import FormControl from "@material-ui/core/FormControl";
import Checkbox from "@material-ui/core/Checkbox";
import DialogActions from "@material-ui/core/DialogActions";
import {getCardById} from "../types/cards";

export interface IBuyDialogProps {
    card: INormalOrLegendCard | IBasicCard,
    helpers: CardID[],
    G: IG,
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>,
    playerID: PlayerID,
}

export const BuyCard = ({card, helpers, G, ctx, moves, playerID}: IBuyDialogProps) => {

    useI18n(i18n);
    const [open, setOpen] = React.useState(false);

    const [depositExtra, setDepositExtra] = React.useState(0);

    const [checked, setChecked] = React.useState(Array(helpers.length).fill(false));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newHelper = [...checked]
        let idx: number = parseInt(e.target.value);
        newHelper[idx] = !newHelper[idx];
        let newCost = resCost(G, ctx, {
            buyer: playerID,
            target: card.cardId,
            resource: 0,
            deposit: 0,
            helper: helpers.filter((c, idx) => newHelper[idx]),
        }, false);
        let newMin = Math.max(newCost - pub.resource, 0);
        let newMax = Math.min(newCost, pub.deposit);
        let newExtraDepositLimit = newMax - newMin
        if (newExtraDepositLimit > 0 && depositExtra > newExtraDepositLimit) {
            setDepositExtra(newExtraDepositLimit);
        }
        if (depositExtra < 0) {
            setDepositExtra(0);
        }
        setChecked(newHelper);
    }

    const pub = G.pub[parseInt(playerID)];
    const realtimeCost = resCost(G, ctx, {
        buyer: playerID,
        target: card.cardId,
        resource: 0,
        deposit: 0,
        helper: helpers.filter((c, idx) => checked[idx]),
    }, false);
    const minDeposit = Math.max(realtimeCost - pub.resource, 0);
    const affordable = canAfford(G, ctx, card, playerID) && pub.action > 0;
    const buttonColor = affordable ? "primary" : "secondary"
    const res = realtimeCost - depositExtra - minDeposit;
    const deposit = depositExtra + minDeposit
    const buyArg = {
        buyer: playerID,
        target: card.cardId,
        resource: res,
        deposit: deposit,
        helper: helpers.filter((c, idx) => checked[idx]),
    };
    const sliderRequired = pub.deposit + pub.resource > realtimeCost && pub.deposit > 0 && pub.resource > 0;
    const maxDeposit = Math.min(realtimeCost, pub.deposit);
    const canBuy: boolean = canBuyCard(G, ctx, buyArg);
    const buy = () => moves.buyCard(buyArg);
    const canHelp = (helper: string): boolean => {
        let helperCard = getCardById(helper);
        if (card.cost.industry === 0) {
            if (card.cost.aesthetics === 0) {
                return false;
            } else {
                return helperCard.aesthetics > 0;
            }
        } else {
            if (card.cost.aesthetics === 0) {
                return helperCard.industry > 0;
            } else {
                return helperCard.aesthetics > 0 || helperCard.industry > 0;
            }
        }
    }

    const handleSliderChange = (event: any, newValue: number | number[]) => {
        if (typeof newValue === "number") {
            setDepositExtra(newValue);
        }
    };

    const refreshCost = () => {
        setDepositExtra(0);
    }

    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const buyAndClose = () => {
        handleClose();
        buy();
    }

    const canMakeBuyMove = () => {
        if (pub.school?.cardId === "2301" && card.region !== Region.EE) {
            return ctx.currentPlayer === playerID && canBuy && pub.resource >= res && pub.deposit >= deposit && pub.action > 0 && pub.vp > 0
        } else {
            return ctx.currentPlayer === playerID && canBuy && pub.resource >= res && pub.deposit >= deposit && pub.action > 0
        }

    }
    const getValueText = (n: number) => n.toString();

    return <Grid item>
        <Button
            onClick={handleOpen}
            color={buttonColor}
            variant={"outlined"}
        >{i18n.dialog.buyCard.board}
            {getCardName(card.cardId)}
            {card.category === CardCategory.BASIC ? '(' + G.basicCards[card.cardId as BasicCardID].toString() + ')' : ""}
        </Button>
        <Dialog onClose={handleClose} open={open}>
            <DialogTitle>
                {i18n.dialog.buyCard.board}
                {getCardName(card.cardId)}
                {i18n.dialog.buyCard.cost} {card.cost.res}
                {i18n.pub.industryRequirement} {card.cost.industry}
                {i18n.pub.aestheticsRequirement} {card.cost.aesthetics}
            </DialogTitle>
            <DialogContent>
                <Typography>
                    {i18n.pub.industryMarker} {card.industry}
                    {i18n.pub.aestheticsMarker} {card.aesthetics}
                    {cardEffectText(card.cardId as ClassicCardID)}</Typography>
                <FormControl required component="fieldset">
                    <FormLabel component="legend" error={!canBuy}>
                        {i18n.dialog.buyCard.cost} {i18n.pub.res} {res}
                        {i18n.pub.deposit} {deposit}
                    </FormLabel>
                    <FormGroup>
                        {sliderRequired ? <Slider
                            onChange={handleSliderChange}
                            min={0}
                            max={maxDeposit - minDeposit}
                            step={1}
                            marks
                            getAriaValueText={getValueText}
                            aria-labelledby="deposit-slider"
                            valueLabelDisplay="auto"
                            value={depositExtra}
                        /> : <></>}
                        {helpers.map((p, idx) =>
                            canHelp(p) ? <FormControlLabel
                                key={idx} id={p}
                                control={<Checkbox
                                    value={idx}
                                    checked={checked[idx]}
                                    onChange={handleChange}
                                    name={getCardName(p)}/>}
                                label={
                                    getCardName(p) + "  " +
                                    i18n.pub.industry +
                                    getCardById(p).industry.toString() +
                                    i18n.pub.aesthetics +
                                    getCardById(p).aesthetics.toString()
                                }
                            /> : <div key={idx}/>)}
                    </FormGroup>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button key={1}
                        variant={"contained"}
                        onClick={buyAndClose} color="primary"
                        disabled={!canMakeBuyMove()}>
                    {i18n.confirm}
                </Button>
                <Button key={2}
                        onClick={handleClose} color="secondary" variant={"outlined"}>
                    {i18n.cancel}
                </Button>
                <Button key={3}
                        onClick={refreshCost}
                        color="secondary" variant={"outlined"}>
                    {i18n.dialog.buyCard.refresh}
                </Button>
            </DialogActions>
        </Dialog>
    </Grid>
}

export interface ICommentProps {
    slot: ICardSlot,
    comment: (slot: ICardSlot, card: IBasicCard | null) => void,
    G: IG,
}

export const Comment = ({slot, comment, G}: ICommentProps) => {
    useI18n(i18n);
    const cards: BasicCardID[] = [BasicCardID.B01, BasicCardID.B02, BasicCardID.B03, BasicCardID.B04, BasicCardID.B05];

    const removeComment = () => {
        comment(slot, null)
    }

    const doComment = (choice: string) => {
        comment(slot, getBasicCard(choice as BasicCardID))
    }

    return slot.comment === null ? <ChoiceDialog
            initial={false}
            callback={doComment}
            choices={cards.map(
                id => {
                    return {
                        label: getCardName(id),
                        disabled: G.basicCards[id] === 0,
                        hidden: false,
                        value: id
                    }
                }
            )
            }
            defaultChoice={"B01"} show={false}
            title={i18n.dialog.buyCard.basic} toggleText={i18n.dialog.buyCard.basic}/> :
        <Button onClick={removeComment}>
            {i18n.dialog.comment.removeCommentCard}
        </Button>
}

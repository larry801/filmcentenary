import React from "react";
import {IG} from "../types/setup";
import {BasicCardID, IBasicCard, ICard, ICardSlot, INormalOrLegendCard} from "../types/core";
import {ChoiceDialog} from "./modals";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import {Button, Checkbox, DialogActions, DialogContent, DialogTitle, FormControl, FormGroup} from "@material-ui/core";
import Dialog from "@material-ui/core/Dialog";
import FormLabel from "@material-ui/core/FormLabel";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import {getBasicCard} from "../constant/cards/basic";
import {Ctx, PlayerID} from "boardgame.io";
import {canAfford, canBuyCard, resCost} from "../game/util";
import Slider from "@material-ui/core/Slider";
import Grid from "@material-ui/core/Grid";

export interface IBuyDialogProps {
    card: INormalOrLegendCard | IBasicCard,
    helpers: ICard[],
    G: IG,
    ctx: Ctx,
    moves: Record<string, (...args: any[]) => void>,
    playerID: PlayerID,
}

export const BuyCard = ({card, helpers, G, ctx, moves, playerID}: IBuyDialogProps) => {

    useI18n(i18n);
    const [open, setOpen] = React.useState(false);
    const [cost, setCost] = React.useState(resCost(G, ctx, {
        buyer: playerID,
        target: card,
        resource: 0,
        deposit: 0,
        helper: [],
    }));
    const [deposit, setDeposit] = React.useState(Math.max(resCost(G, ctx, {
        buyer: playerID,
        target: card,
        resource: 0,
        deposit: 0,
        helper: [],
    }) - G.pub[parseInt(playerID)].resource,0));
    const [checked, setChecked] = React.useState(Array(helpers.length).fill(false));

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newHelper = [...checked]
        let idx: number = parseInt(e.target.value);
        newHelper[idx] = !newHelper[idx];
        let newCost = resCost(G, ctx, {
            buyer: playerID,
            target: card,
            resource: 0,
            deposit: 0,
            helper: helpers.filter((c, idx) => newHelper[idx]),
        });
        let newMin = Math.max(newCost - pub.resource,0);
        let newMax = Math.min(newCost,pub.deposit);
        if(deposit>newMax){
            setDeposit(newMax);
        }
        if(deposit<newMin){
            setDeposit(newMin);
        }
        setChecked(newHelper);
        setCost(newCost);
        console.log(newHelper,newCost,deposit,newMax,newMin);
    }

    const affordable = canAfford(G, ctx, card, playerID);
    const pub = G.pub[parseInt(playerID)];
    const buyArg = {
        buyer: playerID,
        target: card,
        resource: cost - deposit,
        deposit: deposit,
        helper: helpers.filter((c, idx) => checked[idx]),
    };
    const sliderRequired = pub.deposit + pub.resource > cost && pub.deposit > 0 && pub.resource > 0;
    const minDeposit = Math.max(cost - pub.resource ,0);
    const maxDeposit = Math.min(cost,pub.deposit);
    const canBuy: boolean = canBuyCard(G, ctx, buyArg);
    const buy = () => {moves.buyCard(buyArg)};
    const canHelp = (helper: INormalOrLegendCard | IBasicCard): boolean => {
        if (card.cost.industry === 0 ) {
            if(card.cost.aesthetics === 0){
                return false;
            }else {
                return helper.aesthetics > 0;
            }
        }else{
            if(card.cost.aesthetics === 0){
                return helper.industry > 0;
            }else {
                return helper.aesthetics > 0 || helper.industry > 0;
            }
        }
    }

    const handleSliderChange = (event: any, newValue: number | number[]) => {
        console.log(event,newValue)
        if (typeof newValue === "number") {
            setDeposit(newValue);
        }
    };

    return <Grid item>
        <Button
            disabled={!affordable}
            onClick={() => {setOpen(true)}}
            variant={"outlined"}
        >{i18n.dialog.buyCard.board} {i18n.card[card.cardId as BasicCardID]}</Button>
        <Dialog onClose={() => setOpen(false)} open={open}>
            <DialogTitle>
                {i18n.dialog.buyCard.board}
                {i18n.card[card.cardId as BasicCardID]}
                {i18n.dialog.buyCard.cost} {card.cost.res}
                {i18n.pub.industryMarker} {card.cost.industry}
                {i18n.pub.aestheticsMarker} {card.cost.aesthetics}
            </DialogTitle>
            <DialogContent>
                <FormControl required component="fieldset">
                    <FormLabel component="legend" error={!canBuy}>
                        {i18n.dialog.buyCard.cost} {i18n.pub.res} {cost - deposit}
                        {i18n.pub.deposit} {deposit}
                    </FormLabel>
                    <FormGroup>
                        {sliderRequired ? <Slider
                            onChange={handleSliderChange}
                            min={minDeposit}
                            max={maxDeposit}
                            step={1}
                            marks
                            getAriaValueText={(n:number)=>n.toString()}
                            aria-labelledby="deposit-slider"
                            valueLabelDisplay="auto"
                            value={deposit}
                        /> : <></>}
                        {helpers.map((p, idx) =>
                            canHelp(p as INormalOrLegendCard|IBasicCard) ? <FormControlLabel
                                key={idx} id={p.cardId}
                                control={<Checkbox
                                    value={idx}
                                    checked={checked[idx]}
                                    onChange={(e) => handleChange(e)}
                                    name={i18n.card[p.cardId as BasicCardID]}/>}
                                label={i18n.card[p.cardId as BasicCardID] + "  "  + i18n.pub.industry +
                                    // @ts-ignore
                                    p.industry.toString() + i18n.pub.aesthetics + p.aesthetics.toString()
                                }
                            /> : <></>)}
                    </FormGroup>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button
                    variant={"contained"}
                    onClick={() => {
                        buy();
                        setOpen(false);
                    }} color="primary"
                    disabled={!canBuy}>
                    {i18n.confirm}
                </Button>
                <Button onClick={() => {
                    setOpen(false)
                }} color="secondary" variant={"outlined"}>
                    {i18n.cancel}
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

    return slot.comment === null ? <ChoiceDialog
            initial={false}
            callback={(choice) => {
                // @ts-ignore
                comment(slot, getBasicCard(choice))
            }}
            choices={cards.map(
                id => {
                    return {
                        label: i18n.card[id],
                        disabled: G.basicCards[id] === 0,
                        hidden: false,
                        value: id
                    }
                }
            )
            }
            defaultChoice={"B01"} show={false}
            title={i18n.dialog.buyCard.basic} toggleText={i18n.dialog.buyCard.basic}/> :
        <Button onClick={() => comment(slot, null)}>{i18n.dialog.comment.removeCommentCard}</Button>
}

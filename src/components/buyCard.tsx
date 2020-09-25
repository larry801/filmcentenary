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
import Tooltip from "@material-ui/core/Tooltip";
import {getBasicCard} from "../constant/cards/basic";
import Typography from "@material-ui/core/Typography";
import {PlayerID} from "boardgame.io";


export interface IBuyDialogProps {
    slot: ICardSlot,
    card: INormalOrLegendCard,
    helpers: ICard[],
    buy: (target:ICard,resource:number,cash:number,helper:ICard[])=> void,
    canBuy: (target:ICard,resource:number,cash:number,helper:ICard[]) => boolean,
    affordable: boolean,
    G: IG,
    playerID: PlayerID,
}

export const BuyCard = ({canBuy, card, buy, affordable, helpers, G, playerID}: IBuyDialogProps) => {

    useI18n(i18n);
    const [open, setOpen] = React.useState(false);
    const [res, setRes] = React.useState(0);
    const [deposit, setDeposit] = React.useState(0);
    const [checked, setChecked] = React.useState(helpers.map(c => false));
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newHelper = [...checked]
        // @ts-ignore
        newHelper[e.target.value] = !newHelper[e.target.value];
        setChecked(newHelper)
    }

    const pub = G.pub[parseInt(playerID)];


    return <div>
        <Button disabled={!affordable} onClick={() => {
            setOpen(true)
        }}>
            {i18n.dialog.buyCard.board}
        </Button>
        <Dialog onClose={() => setOpen(false)} open={open}>
            <DialogTitle>
                {i18n.dialog.buyCard.board} {card.name}
            </DialogTitle>
            <DialogContent>
                <div style={{display: 'inline-flex'}} key={"res-"}>
                    <Typography variant={"h6"}>{i18n.dialog.buyCard.cost} {card.cost.res}</Typography>
                    <Typography variant={"h6"}>{i18n.pub.industry} {card.cost.industry}</Typography>
                    <Typography variant={"h6"}>{i18n.pub.aesthetics} {card.cost.aesthetics}</Typography>
                </div>
                <div style={{display: 'block'}} key={"res-"}>
                    <Typography variant={"h6"}>{i18n.pub.industry} {pub.industry}</Typography>
                    <Typography variant={"h6"}>{i18n.pub.aesthetics} {pub.aesthetics}</Typography>
                </div>
                <FormControl required component="fieldset">
                    <FormLabel component="legend">
                        {i18n.dialog.buyCard.board} {card.name}
                    </FormLabel>
                    <FormGroup>
                        <div style={{display: 'inline-flex'}} key={"res-"}>
                            <Button disabled={res <= 0}
                                    onClick={() => setRes(res - 1)}
                            >-</Button>
                            <Typography>{res}</Typography>
                            <Button  onClick={() => setRes(res + 1)}
                                    disabled={G.pub[parseInt(playerID)].cash === deposit}
                            >+</Button></div>
                        <div style={{display: 'inline-flex'}} key={"deposit"}>
                            <Button disabled={deposit <= 0}
                                    onClick={() => {
                                        setDeposit(deposit - 1)
                                    }}>-</Button>
                            <Typography>{deposit}</Typography>
                            <Button onClick={() => setDeposit(deposit + 1)}
                                    disabled={G.pub[parseInt(playerID)].resource === res}
                            >+</Button>
                        </div>

                        {helpers
                            // @ts-ignore
                            .filter(c=> c.industry>0 || c.aesthetics>0)
                            .map((p, idx) =>
                            <Tooltip title={p.name} key={idx} leaveDelay={50}>
                                <FormControlLabel disabled={false}
                                                  key={idx} id={p.cardId}
                                                  control={<Checkbox
                                                      value={idx}
                                                      checked={checked[idx]}
                                                      onChange={(e)=>handleChange(e)}
                                                      name={p.name}/>}
                                                  label={p.name}
                                />
                            </Tooltip>)}
                    </FormGroup>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button
                    variant={"contained"}
                    onClick={() => {
                        buy(card,res,deposit,helpers.filter((c,idx)=>checked[idx]))
                    }} color="primary"
                    disabled={!canBuy(card,res,deposit,helpers.filter((c,idx)=>checked[idx]))}
                >
                    {i18n.confirm}
                </Button>
                <Button onClick={() => {
                    setOpen(false)
                }} color="secondary" variant={"outlined"}>
                    {i18n.cancel}
                </Button>
            </DialogActions>
        </Dialog>
    </div>
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

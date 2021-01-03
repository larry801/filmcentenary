import React from "react";
import {LogEntry} from "boardgame.io";
import {CardID, getCardById, MoveNames} from "../../types/core";
import i18n from "../../constant/i18n";
import CardInfo, {effName, getCardName} from "../card";
import {useI18n} from "@i18n-chain/react";
import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import Paper from "@material-ui/core/Paper";
import DialogActions from "@material-ui/core/DialogActions";
import {IG} from "../../types/setup";

export const getMoveText = (l: LogEntry): string => {
    const pid = l.action.payload.playerID
    switch (l.action.type) {
        case "MAKE_MOVE":
            const moveName = l.action.payload.type as MoveNames
            if (moveName === MoveNames.requestEndTurn) {
                return `p${pid}.moves.requestEndTurn("${pid}");`
            } else {
                if (l.action.payload.args === null) {
                    return `p${pid}.moves.${moveName}([]);`
                } else {
                    return `p${pid}.moves.${moveName}(${JSON.stringify(l.action.payload.args[0])});`
                }
            }
        case "UNDO":
            return `p${pid}.undo();`
        case "REDO":
            return `p${pid}.redo();`
        default:
            return ""
    }
}

export const getLogText = (l: LogEntry, getPlayerName: (name: string) => string, G: IG): string => {
    switch (l.action.type) {
        case "GAME_EVENT":
            if (l.action.payload.type === "endTurn" && l.turn !== 1) {
                return i18n.action.turnEnd({a: l.turn - 1})
            } else {
                return "";
            }
        case "MAKE_MOVE":
            let moveName = l.action.payload.type as MoveNames
            if (moveName === MoveNames.chooseEffect) {
                return getPlayerName(l.action.payload.playerID) + i18n.effect.chose + effName(
                    // @ts-ignore
                    l.action.payload.args[0].effect
                )
            } else {
                if (moveName === MoveNames.updateSlot) {
                    const resIdx = l.action.payload.args[0].updateHistoryIndex
                    const res = G.updateCardHistory.length < (resIdx + 1) ?
                        "" :
                        G.updateCardHistory[resIdx].map(c => '【' + getCardName(c) + '】').join('')
                    // @ts-ignore
                    return `${getPlayerName(l.action.payload.playerID)}${i18n.moves[moveName]({args: l.action.payload.args})}${res}`
                } else {
                    return getPlayerName(l.action.payload.playerID) + i18n.moves[moveName]({
                        // @ts-ignore
                        args: l.action.payload.args
                    })
                }
            }
        case
        "REDO"
        :
            return getPlayerName(l.action.payload.playerID) + i18n.action.redo
        case
        "UNDO"
        :
            return getPlayerName(l.action.payload.playerID) + i18n.action.undo
        default:
            return ""
    }
}

export interface ICardListProps {
    cards: CardID[],
    label: JSX.Element,
    title: string,
}

export const CardList = ({cards, title, label}: ICardListProps) => {

    useI18n(i18n);

    const [open, setOpen] = React.useState(false);
    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };
    return <Grid item xs={12}>
        <Button
            aria-label={title}
            fullWidth
            variant={"outlined"}
            onClick={handleClickOpen}
            style={{textTransform: 'none'}}
        > {label}</Button>
        <Dialog
            aria-label={title}
            open={open}
            onClose={handleClose}
        >
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                {cards.map(c => {
                        const cardObj = getCardById(c);
                        const feeText = cardObj.cost ? `${cardObj.cost.res}/${cardObj.cost.industry}/${cardObj.cost.aesthetics}/${cardObj.vp}` : `${c}(${cardObj.vp})`;
                        return <Paper variant="outlined" key={title + c}>
                            <CardInfo cid={c}/>
                            {feeText}
                        </Paper>
                    }
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} color="primary">
                    {i18n.confirm}
                </Button>
            </DialogActions>
        </Dialog></Grid>
}

export default CardList;

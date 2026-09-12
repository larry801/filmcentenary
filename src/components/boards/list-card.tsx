import React from "react";
import {LogEntry} from "boardgame.io";
import {CardID, getCardById, MoveNames} from "../../types/core";
import i18n from "../../constant/i18n";
import CardInfo, {effName, getCardName} from "../card";
import Grid from "@mui/material/Grid";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import Paper from "@mui/material/Paper";
import DialogActions from "@mui/material/DialogActions";
import {IG} from "../../types/setup";
import PrestigeIcon from "@mui/icons-material/EmojiEvents";
import AestheticsIcon from "@mui/icons-material/ImportContacts";
import IndustryIcon from "@mui/icons-material/Settings";
import ResourceIcon from "@mui/icons-material/MonetizationOn";
import Typography from "@mui/material/Typography";


export const getLogText = (l: LogEntry, getPlayerName: (name: string) => string, G: IG): string => {
    switch (l.action.type) {
        case "GAME_EVENT":
            if (l.action.payload.type === "endTurn" && l.turn !== 1) {
                return i18n.chain.action.turnEnd({a: l.turn - 1})
            } else {
                return "";
            }
        case "MAKE_MOVE":
            let moveName = l.action.payload.type;
            if (moveName === MoveNames.chooseEffect) {
                return getPlayerName(l.action.payload.playerID) + i18n.chain.effect.chose + effName(
                    // @ts-ignore
                    l.action.payload.args[0].effect
                )
            } else {
                if (moveName === MoveNames.updateSlot) {
                    const updatedResult = l.metadata.updatedResult;
                    const resultText = typeof updatedResult === typeof Array ? updatedResult.map((c: string) => '【' + getCardName(c) + '】').join('') : "";
                    return `${getPlayerName(l.action.payload.playerID)}${i18n.chain.moves[moveName]({args: l.action.payload.args})}${resultText}`
                } else {
                    // @ts-ignore
                    return getPlayerName(l.action.payload.playerID) + i18n.chain.moves[moveName]({
                        // @ts-ignore
                        args: l.action.payload.args
                    })
                }
            }
        case
        "REDO"
        :
            return getPlayerName(l.action.payload.playerID) + i18n.chain.action.redo
        case
        "UNDO"
        :
            return getPlayerName(l.action.payload.playerID) + i18n.chain.action.undo
        default:
            return ""
    }
}

export interface ICardListProps {
    cards: CardID[],
    label: React.JSX.Element,
    title: string,
}

const CardListContent = ({cards}: { cards: CardID[] }) => <>
    {cards.map((c, idx) => {
            const cardObj = getCardById(c);
            return <Paper variant="outlined" key={`${c}-${idx}`}>
                <CardInfo cid={c}/>
                <Typography
                    style={{
                        display: 'inline-flex',
                        verticalAlign: 'middle'
                    }}>
                    <ResourceIcon/>
                    {cardObj.cost.res}
                    <IndustryIcon/>
                    {cardObj.cost.industry}
                    <AestheticsIcon/>
                    {cardObj.cost.aesthetics}
                    <PrestigeIcon/>
                    {cardObj.vp}
                </Typography>
            </Paper>
        }
    )}
</>

const CardListInner = ({cards, title, label}: ICardListProps) => {

    i18n.use();

    const [open, setOpen] = React.useState(false);
    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };
    // The dialog body is only built when it is actually opened: these lists
    // exist for every pile of every player and used to be rendered on every
    // state update even while closed.
    const content = React.useMemo(
        () => (open ? <CardListContent cards={cards}/> : null),
        [open, cards]
    );
    return <Grid size={12}>
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
                {content}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} color="primary">
                    {i18n.chain.confirm}
                </Button>
            </DialogActions>
        </Dialog></Grid>
}

/** Cards only change when their contents change, not on every state update. */
const cardsEqual = (a: ICardListProps, b: ICardListProps) =>
    a.title === b.title &&
    a.cards.length === b.cards.length &&
    a.cards.every((c, idx) => c === b.cards[idx]);

export const CardList = React.memo(CardListInner, cardsEqual);

export default CardList;

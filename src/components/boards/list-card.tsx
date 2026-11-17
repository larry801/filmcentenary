import React from "react";
import {LogEntry} from "boardgame.io";
import {CardCategory, CardID, getCardById, MoveNames} from "../../types/core";
import i18n from "../../constant/i18n";
import CardInfo, {CardAdjustBadge, effName, getCardName} from "../card";
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

import '../card.css';
import {CardRevealReason, ICardReveal} from "../../game/cardReveal";


const getCardRevealText = (reveal: ICardReveal): string => {
    const cardsText = reveal.cards.map(c => '【' + getCardName(c) + '】').join('');
    switch (reveal.reason) {
        case CardRevealReason.NEW_ERA:
            const regionText = reveal.region === undefined ? "" : i18n.chain.region[reveal.region];
            const eraText = reveal.era === undefined ? "" : i18n.chain.era[reveal.era];
            return `${regionText}${eraText}${i18n.chain.action.newEraReveal}${cardsText}`;
        case CardRevealReason.UPDATE:
            return `${i18n.chain.action.updateReveal}${cardsText}`;
        default:
            return `${i18n.chain.action.refillReveal}${cardsText}`;
    }
}

export const getLogText = (l: LogEntry, getPlayerName: (name: string) => string, G: IG): string => {
    const text = getMoveLogText(l, getPlayerName, G);
    const reveals: ICardReveal[] = l.metadata?.cardReveals ??
        // 旧记录只有 updateSlot 的 updateResult
        (Array.isArray(l.metadata?.updateResult) ? [{reason: CardRevealReason.UPDATE, cards: l.metadata.updateResult}] : []);
    return [text, ...reveals.map(getCardRevealText)].filter(t => t !== "").join('\n');
}

const getMoveLogText = (l: LogEntry, getPlayerName: (name: string) => string, G: IG): string => {
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
                // @ts-ignore
                return getPlayerName(l.action.payload.playerID) + i18n.chain.moves[moveName]({
                    // @ts-ignore
                    args: l.action.payload.args
                })
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
    label: React.ReactElement,
    title: string,
}

export const CardList = ({cards, title, label}: ICardListProps) => {

    i18n.use();

    const [open, setOpen] = React.useState(false);
    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
    };
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
                {cards.map(c => {
                        const cardObj = getCardById(c);
                        return <Paper variant="outlined" key={title + c} className="dybn-card"
                                style={{
                                    position: 'relative',
                                    backgroundImage: `url("/img/${c}.png")`,
                                    backgroundRepeat: 'no-repeat',
                                    backgroundPosition: 'right center',
                                    backgroundSize: 'auto 100%',
                                    margin: '4px 0',
                                    ...(getCardById(c).category === CardCategory.LEGEND ? {
                                        boxShadow: '2px 2px 2px #000000c4, -1px -1px 1px 1px #dadadacc'
                                    } : {})
                                }}
                            >
                            <CardAdjustBadge cardId={c}/>
                            <CardInfo cid={c}/>
                            <Typography
                                sx={{
                                    display:'inline-flex',
                                    verticalAlign:'middle'
                                }}>
                                <IndustryIcon/>
                                {cardObj.cost.industry}
                                <AestheticsIcon/>
                                {cardObj.cost.aesthetics}
                                <ResourceIcon/>
                                {cardObj.cost.res}
                                <PrestigeIcon/>
                                {cardObj.vp}
                            </Typography>
                        </Paper>
                    }
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} color="primary">
                    {i18n.chain.confirm}
                </Button>
            </DialogActions>
        </Dialog></Grid>
}

export default CardList;

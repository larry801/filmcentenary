import React from "react";
import {FixedSizeList} from "react-window";
import Grid from "@material-ui/core/Grid";
import AutoSizer from "react-virtualized-auto-sizer";
import {LogEntry} from "boardgame.io";
import Button from "@material-ui/core/Button";
import {createStyles, makeStyles, Theme} from '@material-ui/core/styles';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import i18n from "../constant/i18n";
import {useI18n} from "@i18n-chain/react";
import {MoveNames} from "../types/core";
import shortid from 'shortid'
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';
import {effName} from "./card";

const useStyles = makeStyles((theme: Theme) =>
    createStyles({
        root: {
            width: '100%',
            minHeight: 160,
            maxHeight: 800,
            minWidth: 400,
            backgroundColor: theme.palette.background.paper,
        },
    }),
);

export interface ILogViewProps {
    log: LogEntry[],
    getPlayerName: (pid?: string) => string,
}

export const LogView = ({log, getPlayerName}: ILogViewProps) => {

    useI18n(i18n);
    const classes = useStyles();
    const [open, setOpen] = React.useState(true);
    const toggleGameLog = () => {
        setOpen(!open)
    }

    const getMoveText = (l: LogEntry): string => {
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

    const getLogText = (l: LogEntry): string => {
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
                    return getPlayerName(l.action.payload.playerID) + i18n.moves[moveName]({
                        // @ts-ignore
                        args: l.action.payload.args
                    })
                }
            case "REDO":
                return getPlayerName(l.action.payload.playerID) + i18n.action.redo
            case "UNDO":
                return getPlayerName(l.action.payload.playerID) + i18n.action.undo
            default:
                return ""
        }
    }

    const moveText = log.map((l: LogEntry) => getMoveText(l)).join("\r\n");
    const onCopyMove = () => {
        copy(moveText, {
            message: i18n.lobby.copyPrompt,
        })
    }
    const logText = log.map((l: LogEntry) => getLogText(l)).join("\r\n");
    const onCopyLog = () => {
        copy(logText, {
            message: i18n.lobby.copyPrompt,
        })
    }

    return <Grid item container aria-live="polite" xs={12}>
        <Button fullWidth={true} onClick={toggleGameLog}>
            {i18n.pub.gameLog}
        </Button>
        <IconButton
            color="primary"
            aria-label={i18n.lobby.copyPrompt}
            edge="start"
            onClick={onCopyLog}>
            <ContentCopyIcon/>
        </IconButton>
        <IconButton
            color="secondary"
            aria-label={i18n.lobby.copyPrompt}
            edge="start"
            onClick={onCopyMove}>
            <ContentCopyIcon/>
        </IconButton>
        {open && <>
            <Grid item xs={12} className={classes.root}>
                <AutoSizer
                    defaultHeight={1000}
                    defaultWidth={400}>
                    {({height, width}) => <FixedSizeList
                        className="List"
                        height={height}
                        itemCount={log.length}
                        itemSize={50}
                        width={width}>
                        {({index, style}) => {
                            const i = log.length - index - 1;
                            const text = getLogText(log[i])
                            return text === "" ? <></> : <ListItem
                                button
                                // @ts-ignore
                                style={style}
                                key={shortid.generate()}>
                                <ListItemText primary={text}/>
                            </ListItem>
                        }}
                    </FixedSizeList>}
                </AutoSizer>
            </Grid>
        </>}
    </Grid>
}

export default LogView;

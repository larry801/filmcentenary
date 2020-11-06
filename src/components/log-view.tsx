import React from "react";
import Grid from "@material-ui/core/Grid";
import {LogEntry} from "boardgame.io";
import Button from "@material-ui/core/Button";
import {createStyles, makeStyles, Theme} from '@material-ui/core/styles';
import i18n from "../constant/i18n";
import {useI18n} from "@i18n-chain/react";
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';
import {getLogText, getMoveText} from "./boards/list-card";
import TextareaAutosize from "@material-ui/core/TextareaAutosize";

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

    const moveText = log.map((l: LogEntry) => getMoveText(l)).join("\r\n");
    const onCopyMove = () => {
        copy(moveText, {
            message: i18n.lobby.copyPrompt,
        })
    }
    const logText = log.map((l: LogEntry) => getLogText(l ,getPlayerName)).join("\r\n");
    const onCopyLog = () => {
        copy(logText, {
            message: i18n.lobby.copyPrompt,
        })
    }
    const cloneLog = [...log]
    const reverseLog = cloneLog.filter(l => l.action.payload.type !== "endStage").reverse()
    const totalLogText = reverseLog.map(l => getLogText(l, getPlayerName)).join('\n');

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
                <TextareaAutosize
                    readOnly={true}
                    rowsMin={1}
                    rowsMax={6}
                    defaultValue={totalLogText}
                    style={{
                        width: "100%"
                    }}
                />
            </Grid>
        </>}
    </Grid>
}

export default LogView;

import React from "react";
import Grid from "@material-ui/core/Grid";
import {LogEntry} from "boardgame.io";
import Button from "@material-ui/core/Button";
import i18n from "../constant/i18n";
import {useI18n} from "@i18n-chain/react";
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';
import {getLogText} from "./boards/list-card";
import TextField from '@material-ui/core/TextField';
import {IG} from "../types/setup";

export interface ILogViewProps {
    log: LogEntry[],
    getPlayerName: (pid?: string) => string,
    G: IG,
}

export const LogView = ({log, getPlayerName, G}: ILogViewProps) => {

    useI18n(i18n);

    const [open, setOpen] = React.useState(true);
    const toggleGameLog = () => {
        setOpen(!open)
    }

    const onCopyMove = () => {
        copy(window.location.origin, {
            message: i18n.lobby.copyPrompt,
        })
    }

    const onCopyLog = () => {
        const logText = log.map((l: LogEntry) => getLogText(l, getPlayerName, G)).join("\r\n");
        copy(logText, {
            message: i18n.lobby.copyPrompt,
        })
    }

    const cloneLog = [...log]
    const reverseLog = cloneLog.filter(l => l.action.type !== "GAME_EVENT").reverse().slice(0, 50);
    const totalLogText = reverseLog.map(l => getLogText(l, getPlayerName, G)).join('\n');

    return <Grid item container xs={12}>
        <Grid item xs={12}>
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
        </Grid>
        {open && <Grid item xs={12}>
            <TextField
                aria-live="polite"
                disabled
                value={totalLogText}
                fullWidth
                multiline
                minRows={2}
                maxRows={8}
                variant="filled"
            />
        </Grid>}
    </Grid>
}

export default LogView;

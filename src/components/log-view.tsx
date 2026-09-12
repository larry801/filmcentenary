import React from "react";
import Grid from "@mui/material/Grid";
import {LogEntry} from "boardgame.io";
import Button from "@mui/material/Button";
import i18n from "../constant/i18n";
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@mui/icons-material/FileCopy';
import IconButton from '@mui/material/IconButton';
import {getLogText} from "./boards/list-card";
import TextField from '@mui/material/TextField';
import {IG} from "../types/setup";

export interface ILogViewProps {
    log: LogEntry[],
    getPlayerName: (pid?: string) => string,
    G: IG,
}

export const LogView = ({log, getPlayerName, G}: ILogViewProps) => {

    i18n.use();

    const [open, setOpen] = React.useState(true);
    const toggleGameLog = () => {
        setOpen(!open)
    }

    const onCopyMove = () => {
        copy(window.location.origin, {
            message: i18n.chain.lobby.copyPrompt,
        })
    }

    const onCopyLog = () => {
        const logText = log.map((l: LogEntry) => getLogText(l, getPlayerName, G)).join("\r\n");
        copy(logText, {
            message: i18n.chain.lobby.copyPrompt,
        })
    }

    const cloneLog = [...log]
    const reverseLog = cloneLog.filter(l => l.action.type !== "GAME_EVENT").reverse().slice(0, 50);
    const totalLogText = reverseLog.map(l => getLogText(l, getPlayerName, G)).join('\n');

    return <Grid container size={12}>
        <Grid size={12}>
            <Button fullWidth={true} onClick={toggleGameLog}>
                {i18n.chain.pub.gameLog}
            </Button>
            <IconButton
                color="primary"
                aria-label={i18n.chain.lobby.copyPrompt}
                edge="start"
                onClick={onCopyLog}>
                <ContentCopyIcon/>
            </IconButton>
            <IconButton
                color="secondary"
                aria-label={i18n.chain.lobby.copyPrompt}
                edge="start"
                onClick={onCopyMove}>
                <ContentCopyIcon/>
            </IconButton>
        </Grid>
        {open && <Grid size={12}>
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

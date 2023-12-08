import React from "react";
import Grid from "@material-ui/core/Grid";
import {LogEntry} from "boardgame.io";
import Button from "@material-ui/core/Button";
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';
import {getLogText} from "../util/text";
import TextField from '@material-ui/core/TextField';
import {SongJinnGame} from "../constant/setup";

export interface ILogViewProps {
    log: LogEntry[],
    getPlayerName: (pid: string) => string,
    G: SongJinnGame,
}

export const LogView = ({log, getPlayerName, G}: ILogViewProps) => {


    const [open, setOpen] = React.useState(true);
    const toggleGameLog = () => {
        setOpen(!open)
    }

    const onCopyMove = () => {
        copy(window.location.toString(), {
            message: "复制",
        })
    }

    const onCopyLog = () => {
        const logText = log.map((l: LogEntry) => getLogText(l)).join("\r\n");
        copy(logText, {
            message: "复制",
        })
    }

    const cloneLog = [...log];
    const reverseLog = cloneLog.filter(l => l.action.type !== "GAME_EVENT").reverse().slice(0, 50);
    const totalLogText = reverseLog.map(l => getLogText(l)).join('\n');

    return <Grid item container xs={12}>
        <Grid item xs={12}>
            <Button fullWidth={true} onClick={toggleGameLog}>
                "记录"
            </Button>
            <IconButton
                color="primary"
                aria-label={"复制"}
                edge="start"
                onClick={onCopyLog}>
                <ContentCopyIcon/>
            </IconButton>
            <IconButton
                color="secondary"
                aria-label={"复制"}
                edge="start"
                onClick={onCopyMove}>
                <ContentCopyIcon/>
            </IconButton>
        </Grid>
        {open && <Grid item xs={12}>
            <TextField
                disabled
                defaultValue={totalLogText}
                fullWidth
                multiline
                minRows={8}
                maxRows={8}
                variant="filled"
            />
        </Grid>}
    </Grid>
}

export default LogView;

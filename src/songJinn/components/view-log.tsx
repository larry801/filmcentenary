import React from "react";
import Grid from "@material-ui/core/Grid";
import {LogEntry} from "boardgame.io";
import Button from "@material-ui/core/Button";
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import {getLogText} from "../util";
import {SongJinnGame} from "../constant/general";
import {useI18n} from "@i18n-chain/react";
import i18n from "../../constant/i18n";
import {logger} from "../../game/logger";

export interface ILogViewProps {
    log: LogEntry[],
    getPlayerName: (pid: string) => string,
    G: SongJinnGame,
}

export const LogView = ({log, getPlayerName, G}: ILogViewProps) => {

    useI18n(i18n);

    const [open, setOpen] = React.useState(true);
    const toggleGameLog = () => {
        setOpen(!open)
    }

    const onCopyMove = () => {
        copy(window.location.toString(), {
            message: "复制",
        })
    }

    const process = () => {
        const log2 = [`process`]
        let logs: LogEntry[] = [];
        for (let i = 0; i < log.length; i++) {
            const entry = log[i];
            log2.push('\ncheck');
            log2.push(JSON.stringify(entry._stateID));
            if (entry.action.type === "UNDO") {
                log2.push("\nUNDO")
                const popped = [];
                let prev = logs.pop();
                log2.push('\nprev');
                log2.push(JSON.stringify(prev));
                while (prev !== undefined) {
                    if (prev.action.payload.playerID !== entry.action.payload.playerID) {
                        popped.push(prev);
                        log2.push('\nnext');
                        prev = logs.pop();
                        log2.push('\nprev');
                        log2.push(JSON.stringify(prev));

                    } else {
                        log2.push("\nout of loop");
                        break;
                    }
                }
                log2.push('\npopped')
                log2.push(JSON.stringify(popped));
                logs = logs.concat(popped.reverse());

                log2.push('\nlogs')
                log2.push(JSON.stringify(logs));
            } else {
                logs.push(entry);
            }
        }
        logger.debug(`${G.matchID}|${log2.join('')}`);
        return logs;
    }

    const processedLogs = process();
    const onCopyLog = () => {
        const logText = processedLogs.map((l: LogEntry) => getLogText(G, l)).join("\r\n");
        copy(logText, {
            message: "复制",
        })
    }

    const cloneLog = [...processedLogs];
    const reverseLog = cloneLog.filter(l => l.action.type !== "GAME_EVENT").reverse().slice(0, 50);
    const totalLogText = reverseLog.map(l => getLogText(G, l)).join('\n');

    return <Grid item container xs={12}>
        <Grid item xs={12}>
            <Button fullWidth={true} onClick={toggleGameLog}>
                {i18n.pub.gameLog}
            </Button>
            <IconButton
                color="primary"
                aria-label={"复制"}
                edge="start"
                onClick={onCopyLog}>

                <ContentCopyIcon/>复制 {i18n.pub.gameLog}
            </IconButton>
            <IconButton
                color="secondary"
                aria-label={"复制"}
                edge="start"
                onClick={onCopyMove}>
                <ContentCopyIcon/>复制链接
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

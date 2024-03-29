import React from "react";
import Grid from "@material-ui/core/Grid";
import {LogEntry} from "boardgame.io";
import Button from "@material-ui/core/Button";
import copy from "copy-to-clipboard";
import ContentCopyIcon from '@material-ui/icons/FileCopy';
import IconButton from '@material-ui/core/IconButton';
import TextField from '@material-ui/core/TextField';
import {getLogText, getMoveText} from "../util";
import {SongJinnGame} from "../constant/general";
import {useI18n} from "@i18n-chain/react";
import i18n from "../../constant/i18n";
import {logger} from "../../game/logger";
import Paper from "@material-ui/core/Paper";

export interface ILogViewProps {
    log: LogEntry[],
    getPlayerName: (pid: string) => string,
    G: SongJinnGame,
}

interface INewLogProps {
    G: SongJinnGame,
    l: LogEntry[],
    count: number
}

export const NewLog = ({l, G, count}: INewLogProps) => {
    return <>
        {l.map((e, idx) => <Paper key={`paper-sj-log${idx}`}>{getLogText(G, e)}/{count}</Paper>)}
    </>
}
export const LogView = ({log, getPlayerName, G}: ILogViewProps) => {
    useI18n(i18n);

    const [open, setOpen] = React.useState(true);
    const toggleGameLog = () => {
        setOpen(!open)
    }

    const onCopyMove = () => {
        const moveText = log.map((l: LogEntry) => getMoveText(l)).join("\r\n");
        copy(moveText, {
            message: "复制",
        });
    }

    const process = () => {
        const log2 = [`process`]
        let logs: LogEntry[] = [];
        for (let i = 0; i < log.length; i++) {
            const entry = log[i];
            log2.push('\ncheck');
            log2.push(JSON.stringify(entry._stateID));
            if (entry.action.type === "UNDO") {
                log2.push('\nUNDO');
                logs.pop();
            } else {
                logs.push(entry);
            }
        }
        logger.warn(`${G.matchID}|${log2.join('')}`);
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

    const reverseLog = cloneLog.filter(l => l.action.type !== "GAME_EVENT").reverse().slice(0, 200);
    const newLog = reverseLog.length >= 5 ? reverseLog.slice(0, 5) : reverseLog;
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
                <ContentCopyIcon/>
            </IconButton>
            <NewLog G={G} l={newLog} count={log.length}/>
        </Grid>
        {open && <Grid item xs={12}>
            <TextField
                disabled
                value={totalLogText}
                fullWidth
                multiline
                minRows={8}
                maxRows={20}
                variant="filled"
            />
        </Grid>}
    </Grid>
}


export default LogView;

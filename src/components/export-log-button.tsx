import React from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import {LogEntry} from "boardgame.io";
import {exportFullLog, exportLocalLog, MissingServerLogError} from "../api/match";

export interface ExportLogButtonProps {
    gameName: string;
    matchID: string | undefined;
    serverURL?: string;
    /**
     * The log this board holds. Used when the match never reached the server
     * (local hotseat), where the server has no log to export.
     */
    log?: LogEntry[];
}

/** Downloads the unredacted log of a finished match. Render only after gameover. */
export const ExportLogButton = ({gameName, matchID, serverURL, log}: ExportLogButtonProps) => {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [note, setNote] = React.useState<string | null>(null);
    const onClick = () => {
        setBusy(true);
        setError(null);
        setNote(null);
        const url = serverURL ?? `${window.location.protocol}//${window.location.host}`;
        exportFullLog(url, gameName, matchID ?? "local")
            .catch((e: unknown) => {
                if (e instanceof MissingServerLogError && log !== undefined) {
                    exportLocalLog(gameName, matchID, log);
                    setNote("已导出本机日志（本地对局不在服务器上） / Exported this device's log (local match is not stored on the server)");
                    return;
                }
                setError(e instanceof Error ? e.message : String(e));
            })
            .finally(() => setBusy(false));
    };
    return <>
        <Button fullWidth variant="outlined" disabled={busy} onClick={onClick}>
            导出完整日志 / Export full log
        </Button>
        {note !== null && <Typography variant="caption" color="text.secondary" role="status">{note}</Typography>}
        {error !== null && <Typography variant="caption" color="error" role="alert">{error}</Typography>}
    </>;
};

export default ExportLogButton;

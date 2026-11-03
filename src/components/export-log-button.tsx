import React from "react";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import {exportFullLog} from "../api/match";

export interface ExportLogButtonProps {
    gameName: string;
    matchID: string;
    serverURL?: string;
}

/** Downloads the unredacted log of a finished match. Render only after gameover. */
export const ExportLogButton = ({gameName, matchID, serverURL}: ExportLogButtonProps) => {
    const [busy, setBusy] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const onClick = () => {
        setBusy(true);
        setError(null);
        exportFullLog(serverURL ?? `${window.location.protocol}//${window.location.host}`, gameName, matchID)
            .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
            .finally(() => setBusy(false));
    };
    return <>
        <Button fullWidth variant="outlined" disabled={busy} onClick={onClick}>
            导出完整日志 / Export full log
        </Button>
        {error !== null && <Typography variant="caption" color="error" role="alert">{error}</Typography>}
    </>;
};

export default ExportLogButton;

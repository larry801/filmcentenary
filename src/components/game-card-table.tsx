import React from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import i18n from "../constant/i18n";

export type CardRow = React.ReactNode[];

/**
 * Card thumbnail with a 原图 ("original image") disclosure button: expanding
 * it reveals the full-size printed card inline, without leaving the list.
 *
 * Built on native <details>/<summary> so it stays keyboard-accessible and
 * server-renderable (the card-table unit tests render to static markup).
 * A broken image hides the control rather than showing a broken thumbnail.
 */
export const CardOriginalImage = ({src, alt}: {
    src: string;
    alt: string;
}) => {
    const [failed, setFailed] = React.useState(false);
    if (failed) return null;
    return <details style={{display: "inline-block", maxWidth: "100%"}}>
        <summary style={{
            display: "inline-flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            padding: 4,
            border: "1px solid #cfe3ff",
            borderRadius: 6,
            background: "#f7fbff",
            color: "#0b77ba",
            fontSize: 12,
            whiteSpace: "nowrap",
            cursor: "pointer",
            userSelect: "none",
        }}>
            <img
                src={src}
                alt=""
                width={40}
                loading="lazy"
                onError={() => setFailed(true)}
                style={{display: "block", border: "1px solid #ddd", borderRadius: 2}}
            />
            <span>{i18n.chain.gameCardTables.columns.originalImage}</span>
        </summary>
        <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setFailed(true)}
            style={{
                display: "block",
                maxWidth: "min(100%, 420px)",
                maxHeight: "70vh",
                height: "auto",
                marginTop: 6,
                border: "1px solid #ddd",
                borderRadius: 4,
                boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}
        />
    </details>;
};

/**
 * Shared shell for the per-game card lists. Each game supplies its own rows;
 * this only owns the page heading and the dense MUI table layout so the four
 * card lists (Film Centenary's included) stay visually consistent.
 */
export const CardTablePage = ({title, subtitle, children}: {
    title: string;
    subtitle?: string;
    children: React.ReactNode;
}) => (
    <Container maxWidth={false} disableGutters sx={{px: {xs: 1, sm: 2}, py: 3}}>
        <Typography variant="h5" component="h1" gutterBottom>{title}</Typography>
        {subtitle !== undefined && (
            <Typography variant="body2" color="text.secondary" gutterBottom>{subtitle}</Typography>
        )}
        <Box sx={{display: "flex", flexDirection: "column", gap: 3, mt: 2}}>
            {children}
        </Box>
    </Container>
);

/** `name` is a locale-independent aria-label so E2E tests can target a table. */
export const CardTableSection = ({title, head, rows, name}: {
    title?: string;
    head: React.ReactNode[];
    rows: CardRow[];
    name: string;
}) => (
    <Box component="section">
        {title !== undefined && (
            <Typography variant="h6" component="h2" gutterBottom>{title}</Typography>
        )}
        <TableContainer component={Paper} variant="outlined">
            <Table size="small" aria-label={name} sx={{minWidth: 900}}>
                <TableHead>
                    <TableRow>
                        {head.map((cell, i) => (
                            <TableCell key={i} sx={{fontWeight: 700, whiteSpace: "nowrap"}}>{cell}</TableCell>
                        ))}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map((row, i) => (
                        <TableRow key={i} hover>
                            {row.map((cell, j) => (
                                <TableCell
                                    key={j}
                                    sx={{
                                        verticalAlign: "top",
                                        ...(j === row.length - 1
                                            ? {minWidth: 320, maxWidth: 520, whiteSpace: "normal", wordBreak: "break-word"}
                                            : {}),
                                    }}
                                >{cell}</TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    </Box>
);

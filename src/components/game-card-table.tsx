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

export type CardRow = React.ReactNode[];

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

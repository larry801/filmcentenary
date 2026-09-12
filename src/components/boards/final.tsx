import React from "react";
import i18n from "../../constant/i18n";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import {IG} from "../../types/setup";
import {rank} from "../../game/util";
import {Ctx, PlayerID} from "boardgame.io";
import './final.css';


export interface IFinalScoreTableProps {
    G: IG,
    ctx: Ctx,
    getName:(p:PlayerID)=>string;
}

const FinalScoreTable = ({G, ctx, getName}: IFinalScoreTableProps) => {
    i18n.use();
    const scoreRank = (a: string, b: string) => rank(G, ctx, parseInt(a), parseInt(b));
    const order = [...G.order]
    return <TableContainer component={Paper}>
        <Table className={"table"} size="small" aria-label="Scoring table">
            <TableHead>
                <TableRow>
                    <TableCell>{i18n.chain.playerName.player}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.board}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.card}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.industryAward}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.aesAward}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.archive}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.events}</TableCell>
                    <TableCell>{i18n.chain.gameOver.table.total}</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {order.sort(scoreRank).map(p => {
                    const pub = G.pub[parseInt(p)];
                    const f = pub.finalScoring;
                    return <TableRow key={p}>
                        <TableCell component="th" scope="row">
                            {getName(p)}
                        </TableCell>
                        <TableCell>{pub.vp}</TableCell>
                        <TableCell>{f.card}</TableCell>
                        <TableCell>{f.industryAward}</TableCell>
                        <TableCell>{f.aestheticsAward}</TableCell>
                        <TableCell>{f.archive}</TableCell>
                        <TableCell>{f.events}</TableCell>
                        <TableCell>{f.total}</TableCell>
                    </TableRow>
                })}
            </TableBody>
        </Table>
    </TableContainer>
}

export default FinalScoreTable;

import React from "react";
import {useI18n} from "@i18n-chain/react";
import i18n from "../../constant/i18n";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
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
    useI18n(i18n);
    const scoreRank = (a: string, b: string) => rank(G, ctx, parseInt(a), parseInt(b));
    const order = [...G.order]
    return <TableContainer component={Paper}>
        <Table className={"table"} size="small" aria-label="Scoring table">
            <TableHead>
                <TableRow>
                    <TableCell>{i18n.playerName.player}</TableCell>
                    <TableCell>{i18n.gameOver.table.board}</TableCell>
                    <TableCell>{i18n.gameOver.table.card}</TableCell>
                    <TableCell>{i18n.gameOver.table.building}</TableCell>
                    <TableCell>{i18n.gameOver.table.iAward}</TableCell>
                    <TableCell>{i18n.gameOver.table.aesAward}</TableCell>
                    <TableCell>{i18n.gameOver.table.archive}</TableCell>
                    <TableCell>{i18n.gameOver.table.events}</TableCell>
                    <TableCell>{i18n.gameOver.table.total}</TableCell>
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
                        <TableCell>{f.building}</TableCell>
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

import React from "react";
import {AllClassicCards, BasicCardID, EventCardID, getCardById, ScoreCardID} from "../types/core";
import i18n from "../constant/i18n";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import {archiveCardEffectText, CardEffect, getCardName, getEffectTextById} from "./card";
import './card-table.css';

const DenseTable = () => {
    i18n.use();

    return (
        <TableContainer component={Paper}>
            <Table className={"tab-update"} size="small" aria-label="Card table">
                <TableHead>
                    <TableRow>
                        <TableCell>{i18n.chain.cardTable.cardId}</TableCell>
                        <TableCell>{i18n.chain.pub.era}</TableCell>
                        <TableCell>{i18n.chain.pub.region}</TableCell>
                        <TableCell>{i18n.chain.cardTable.cardName}</TableCell>
                        <TableCell>{i18n.chain.dialog.buyCard.cost}</TableCell>
                        <TableCell>{i18n.chain.pub.vp}/{i18n.chain.pub.industryMarker}/{i18n.chain.pub.aestheticsMarker}</TableCell>
                        <TableCell>{i18n.chain.cardTable.effectIcon}</TableCell>
                        <TableCell>{i18n.chain.cardTable.effectText}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Object.keys(AllClassicCards).sort((a:string,b:string)=>{
                        const aNumId = parseInt(a.slice(1));
                        const bNumId = parseInt(b.slice(1));
                        return aNumId - bNumId
                    }).map(id => {
                        let c = getCardById(id);
                        return <TableRow key={id}>
                            <TableCell component="th" scope="row">
                                {id.slice(1)}
                            </TableCell>
                            <TableCell align="right">{i18n.chain.era[c.era]}</TableCell>
                            <TableCell align="right">{i18n.chain.region[c.region]}</TableCell>
                            <TableCell align="right">
                                {getCardName(id)}
                            </TableCell>
                            <TableCell align="right">{c.cost.res}/{c.cost.industry}/{c.cost.aesthetics}</TableCell>
                            <TableCell align="right">{c.vp}/{c.industry}/{c.aesthetics}</TableCell>
                            <TableCell align="left"><CardEffect cid={c.cardId}/></TableCell>
                            <TableCell align="left">
                                {getEffectTextById(c.cardId)}
                            </TableCell>
                        </TableRow>
                    })}
                </TableBody>
            </Table>
            <Table size="small" aria-label="Card table">
                <TableHead>
                    <TableRow>
                        <TableCell>{i18n.chain.cardTable.cardId}</TableCell>
                        <TableCell>{i18n.chain.cardTable.cardName}</TableCell>
                        <TableCell>{i18n.chain.dialog.buyCard.cost}</TableCell>
                        <TableCell>{i18n.chain.pub.vp}/{i18n.chain.pub.industryMarker}/{i18n.chain.pub.aestheticsMarker}</TableCell>
                        <TableCell>{i18n.chain.cardTable.effectText}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Object.keys(BasicCardID).map(id => {
                        let c = getCardById(id);
                        return <TableRow key={id}>
                            <TableCell component="th" scope="row">
                                {id}
                            </TableCell>
                            <TableCell align="right">
                                {getCardName(id)}
                            </TableCell>
                            <TableCell align="right">{c.cost.res}/{c.cost.industry}/{c.cost.aesthetics}</TableCell>
                            <TableCell align="right">{c.vp}/{c.industry}/{c.aesthetics}</TableCell>
                            <TableCell align="left">
                                {getEffectTextById(c.cardId)}
                            </TableCell>
                        </TableRow>
                    })}
                </TableBody>
            </Table>
            <Table size="small" aria-label="Event card table">
                <TableHead>
                    <TableRow>
                        <TableCell>{i18n.chain.cardTable.cardId}</TableCell>
                        <TableCell>{i18n.chain.pub.era}</TableCell>
                        <TableCell>{i18n.chain.cardTable.cardName}</TableCell>
                        <TableCell>{i18n.chain.cardTable.effectText}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Object.keys(EventCardID).map(id => {
                        let c = getCardById(id);
                        return <TableRow key={id}>
                            <TableCell component="th" scope="row">
                                {id}
                            </TableCell>
                            <TableCell align="right">{i18n.chain.era[c.era]}</TableCell>
                            <TableCell align="right">
                                {getCardName(id)}
                            </TableCell>
                            <TableCell align="left">
                                {
                                    // @ts-ignore
                                    i18n.chain.eventName[id]
                                }
                            </TableCell>
                        </TableRow>
                    })}
                </TableBody>
            </Table>
            <Table size="small" aria-label="Score card table">
                <TableHead>
                    <TableRow>
                        <TableCell>{i18n.chain.cardTable.cardId}</TableCell>
                        <TableCell>{i18n.chain.cardTable.cardName}</TableCell>
                        <TableCell>{i18n.chain.pub.vp}/{i18n.chain.pub.industryMarker}/{i18n.chain.pub.aestheticsMarker}</TableCell>
                        <TableCell>{i18n.chain.cardTable.effectText}</TableCell>

                    </TableRow>
                </TableHead>
                <TableBody>
                    {Object.keys(ScoreCardID).map(id => {
                        let c = getCardById(id);
                        return <TableRow key={id}>
                            <TableCell component="th" scope="row">
                                {id}
                            </TableCell>
                            <TableCell align="right">
                                {getCardName(id)}
                            </TableCell>
                            <TableCell align="right">{c.vp}/{c.industry}/{c.aesthetics}</TableCell>
                            <TableCell>{archiveCardEffectText(c.cardId)}</TableCell>
                        </TableRow>
                    })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export default DenseTable;

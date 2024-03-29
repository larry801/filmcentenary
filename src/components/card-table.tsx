import React from "react";
import {AllClassicCards, BasicCardID, EventCardID, getCardById, ScoreCardID} from "../types/core";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import {archiveCardEffectText, CardEffect, getCardName, getEffectTextById} from "./card";
import './card-table.css';

const DenseTable = () => {
    useI18n(i18n);

    return (
        <TableContainer component={Paper}>
            <Table className={"tab-update"} size="small" aria-label="Card table">
                <TableHead>
                    <TableRow>
                        <TableCell>{i18n.cardTable.cardId}</TableCell>
                        <TableCell>{i18n.pub.era}</TableCell>
                        <TableCell>{i18n.pub.region}</TableCell>
                        <TableCell>{i18n.cardTable.cardName}</TableCell>
                        <TableCell>{i18n.dialog.buyCard.cost}</TableCell>
                        <TableCell>{i18n.pub.vp}/{i18n.pub.industryMarker}/{i18n.pub.aestheticsMarker}</TableCell>
                        <TableCell>{i18n.cardTable.effectIcon}</TableCell>
                        <TableCell>{i18n.cardTable.effectText}</TableCell>
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
                            <TableCell align="right">{i18n.era[c.era]}</TableCell>
                            <TableCell align="right">{i18n.region[c.region]}</TableCell>
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
                        <TableCell>{i18n.cardTable.cardId}</TableCell>
                        <TableCell>{i18n.cardTable.cardName}</TableCell>
                        <TableCell>{i18n.dialog.buyCard.cost}</TableCell>
                        <TableCell>{i18n.pub.vp}/{i18n.pub.industryMarker}/{i18n.pub.aestheticsMarker}</TableCell>
                        <TableCell>{i18n.cardTable.effectText}</TableCell>
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
                        <TableCell>{i18n.cardTable.cardId}</TableCell>
                        <TableCell>{i18n.pub.era}</TableCell>
                        <TableCell>{i18n.cardTable.cardName}</TableCell>
                        <TableCell>{i18n.cardTable.effectText}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Object.keys(EventCardID).map(id => {
                        let c = getCardById(id);
                        return <TableRow key={id}>
                            <TableCell component="th" scope="row">
                                {id}
                            </TableCell>
                            <TableCell align="right">{i18n.era[c.era]}</TableCell>
                            <TableCell align="right">
                                {getCardName(id)}
                            </TableCell>
                            <TableCell align="left">
                                {
                                    // @ts-ignore
                                    i18n.eventName[id]
                                }
                            </TableCell>
                        </TableRow>
                    })}
                </TableBody>
            </Table>
            <Table size="small" aria-label="Score card table">
                <TableHead>
                    <TableRow>
                        <TableCell>{i18n.cardTable.cardId}</TableCell>
                        <TableCell>{i18n.cardTable.cardName}</TableCell>
                        <TableCell>{i18n.pub.vp}/{i18n.pub.industryMarker}/{i18n.pub.aestheticsMarker}</TableCell>
                        <TableCell>{i18n.cardTable.effectText}</TableCell>

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

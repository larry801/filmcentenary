import React from "react";
import {AllClassicCards} from "../types/core";
import {getCardName} from "../game/util";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import makeStyles from '@material-ui/core/styles/makeStyles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import {getCardById} from "../types/cards";
import {CardEffect} from "./card";

const useStyles = makeStyles({
    table: {
        minWidth: 768,
    },
});

const DenseTable = () =>{
    useI18n(i18n);
    const classes = useStyles();

    return (
        <TableContainer component={Paper} >
            <Table className={classes.table} size="small" aria-label="Card table">
                <TableHead>
                    <TableRow>
                        <TableCell>No.</TableCell>
                        <TableCell>Era</TableCell>
                        <TableCell>Region</TableCell>
                        <TableCell>Name</TableCell>
                        <TableCell>{i18n.dialog.buyCard.cost}</TableCell>
                        <TableCell>{i18n.pub.vp}</TableCell>
                        <TableCell>{i18n.pub.industryMarker}/{i18n.pub.aestheticsMarker}</TableCell>
                        <TableCell>Effect text</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Object.keys(AllClassicCards).map(id=>{
                    let rid = id.slice(1);
                    let c = getCardById(id);
                    return <TableRow key={id}>
                        <TableCell component="th" scope="row">
                            {rid}
                        </TableCell>
                        <TableCell align="right">{i18n.era[c.era]}</TableCell>
                        <TableCell align="right">{i18n.region[c.region]}</TableCell>
                        <TableCell align="right">
                            {getCardName(id)}
                        </TableCell>
                        <TableCell align="right">{c.cost.res}/{c.cost.industry}/{c.cost.aesthetics}</TableCell>
                        <TableCell align="right">{c.vp}</TableCell>
                        <TableCell align="right">{c.industry}/{c.aesthetics}</TableCell>
                        <TableCell align="left"><CardEffect cid={c.cardId}/></TableCell>
                    </TableRow>
                })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export default DenseTable;

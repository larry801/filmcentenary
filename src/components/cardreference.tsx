import React from "react";
import {BasicCardID, EventCardID,  NoneBasicCardID} from "../types/core";
import Typography from "@material-ui/core/Typography";
import {cardEffectText, getCardName} from "../game/util";
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


interface ICardItemProps {
    cardId: BasicCardID | EventCardID | NoneBasicCardID,
}

const useStyles = makeStyles({
    table: {
        minWidth: 768,
    },
});

export function DenseTable() {
    const classes = useStyles();

    return (
        <TableContainer component={Paper} >
            <Table className={classes.table} size="small" aria-label="a dense table">
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
                    {Object.keys(NoneBasicCardID).map(id=>{
                    let rid = id.slice(1);
                    let c = getCardById(rid);
                    return <TableRow key={id}>
                        <TableCell component="th" scope="row">
                            {rid}
                        </TableCell>
                        <TableCell align="right">{i18n.era[c.era]}</TableCell>
                        <TableCell align="right">{i18n.region[c.region]}</TableCell>
                        <TableCell align="right">
                            {getCardName(rid)}
                        </TableCell>
                        <TableCell align="right">{c.cost.res}/{c.cost.industry}/{c.cost.aesthetics}</TableCell>
                        <TableCell align="right">{c.vp}</TableCell>
                        <TableCell align="right">{c.industry}/{c.aesthetics}</TableCell>
                        <TableCell align="left">{cardEffectText(rid as NoneBasicCardID)}</TableCell>
                    </TableRow>
                })}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export const CardItem = ({cardId}: ICardItemProps) => {

    useI18n(i18n)
    //const card = getCardById(cardId);
    const effText = () => {
        try {
            // @ts-ignore
            return cardEffectText(cardId)
        } catch (e) {

        }
    }

    return <div>
        <Typography>{getCardName(cardId)} {cardId}</Typography>
        {/*<Typography>{i18n.pub.industryMarker} {card.industry}</Typography>*/}
        {/*<Typography>{i18n.pub.aestheticsMarker} {card.aesthetics}</Typography>*/}
        <Typography>{effText()}</Typography>
    </div>
}


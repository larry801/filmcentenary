import React from "react";
import {BasicCardID, CardCategory, CardType, EventCardID, IEra, NoneBasicCardID, Region} from "../types/core";
import {Grid, Typography} from "@material-ui/core";
import {cardEffectText, getCardName} from "../game/util";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import {effects} from "../constant/effects";
import {makeStyles} from '@material-ui/core/styles';
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
        minWidth: 350,
    },
});

export default function DenseTable() {
    const classes = useStyles();

    return (
        <TableContainer component={Paper}>
            <Table className={classes.table} size="small" aria-label="a dense table">
                <TableHead>
                    <TableRow>
                        <TableCell>{i18n.pub.aestheticsMarker}</TableCell>
                        <TableCell>{i18n.pub.industryMarker}</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {Object.keys(NoneBasicCardID).map(id=>{
                    let rid = id.slice(1);
                    let c = getCardById(rid);
                    return <TableRow key={id}>
                        <TableCell component="th" scope="row">
                            {getCardName(rid)}
                        </TableCell>
                        <TableCell align="right">{i18n.region[c.region]}</TableCell>
                    </TableRow>
                })}
                    {/*{rows.map((row) => (*/}
                    {/*    <TableRow key={row.name}>*/}
                    {/*        <TableCell component="th" scope="row">*/}
                    {/*            {row.name}*/}
                    {/*        </TableCell>*/}
                    {/*        <TableCell align="right">{row.calories}</TableCell>*/}
                    {/*        <TableCell align="right">{row.fat}</TableCell>*/}
                    {/*        <TableCell align="right">{row.carbs}</TableCell>*/}
                    {/*        <TableCell align="right">{row.protein}</TableCell>*/}
                    {/*    </TableRow>*/}
                    {/*))}*/}
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

export const CardList = () => {

    return <>

        {Object.keys(effects).map(id => <Grid item key={id} xs={12}><CardItem
            // @ts-ignore
            cardId={id}/></Grid>)}
    </>
}

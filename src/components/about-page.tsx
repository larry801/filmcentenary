import React from "react";
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import Grid from "@material-ui/core/Grid"
import Typography from "@material-ui/core/Typography";

const AboutPage = () => {
    return (
        <Grid container alignItems="center">
            <Grid item xs={12}>
                    <iframe
                        src="//player.bilibili.com/player.html?aid=213022054&bvid=BV1za411i7pc&cid=573440873&page=1"
                        scrolling="no" frameBorder="no" allowFullScreen={true}
                        width={"100%"}
                        height={"500"}
                    />
            </Grid>
        </Grid>
    )
}

export default AboutPage;
import React from "react";
import i18n from "../constant/i18n";
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography";

const AboutPage = () => {
    return (
        <Grid container sx={{alignItems: 'center'}}>
            <Grid size={12}>
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
import {Link, } from 'react-router-dom'
import React from "react";
import {
    AppBar,
    Drawer as MUIDrawer,
    ListItem, List,  Toolbar, IconButton, Button
} from "@material-ui/core";
import MenuIcon from '@material-ui/icons/Menu';
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";

export const DrawerAppBar = () => {

    useI18n(i18n);
    const [open, setOpen] = React.useState(false);

    return <React.Fragment><AppBar position={"sticky"}>
        <Toolbar>
            <IconButton
                color="inherit"
                aria-label="open drawer"
                onClick={() => setOpen(true)}
                edge="start"
            >
                <MenuIcon/>
            </IconButton>
        </Toolbar>
    </AppBar>
        <MUIDrawer open={open} anchor={"left"} onClose={() => setOpen(false)}>
            <List>
                <ListItem><Button><Link to={'/'}>{i18n.drawer.lobby}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/2p'}>{i18n.drawer.twoPlayer}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/3p'}>{i18n.drawer.threePlayer}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/4p'}>{i18n.drawer.fourPlayer}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/single2p'}>{i18n.drawer.singlePlayer}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/cards'}>{i18n.drawer.cards}</Link></Button></ListItem>
            </List>
        </MUIDrawer>
    </React.Fragment>
}

import {Link} from 'react-router-dom'
import React from "react";
import Drawer from "@material-ui/core/Drawer";
import MenuIcon from '@material-ui/icons/Menu';
import {useI18n} from "@i18n-chain/react";
import i18n from "../constant/i18n";
import AppBar from '@material-ui/core/AppBar';
import IconButton from '@material-ui/core/IconButton';
import Toolbar from '@material-ui/core/Toolbar';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Button from '@material-ui/core/Button';
const MUIDrawer = Drawer;
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
                <ListItem><Button><Link to={'/single3p'}>{i18n.drawer.singlePlayer3p}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/single4p'}>{i18n.drawer.singlePlayer4p}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/cards'}>{i18n.drawer.cards}</Link></Button></ListItem>
            </List>
        </MUIDrawer>
    </React.Fragment>
}

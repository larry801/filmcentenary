import {Link} from 'react-router-dom'
import React from "react";
import Drawer from "@mui/material/Drawer";
import MenuIcon from '@mui/icons-material/Menu';
import i18n from "../constant/i18n";
import AppBar from '@mui/material/AppBar';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import Switch from "@mui/material/Switch"
import Button from '@mui/material/Button';
import {styled} from '@mui/material/styles';
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
const MUIDrawer = Drawer;


const AntSwitch = styled(Switch)(({theme}) => ({
    width: 28,
    height: 16,
    padding: 0,
    display: 'flex',
    '& .MuiSwitch-switchBase': {
        padding: 2,
        color: theme.palette.grey[500],
        '&.Mui-checked': {
            transform: 'translateX(12px)',
            color: theme.palette.common.white,
            '& + .MuiSwitch-track': {
                opacity: 1,
                backgroundColor: theme.palette.primary.main,
                borderColor: theme.palette.primary.main,
            },
        },
    },
    '& .MuiSwitch-thumb': {
        width: 12,
        height: 12,
        boxShadow: 'none',
    },
    '& .MuiSwitch-track': {
        border: `1px solid ${theme.palette.grey[500]}`,
        borderRadius: 16 / 2,
        opacity: 1,
        backgroundColor: theme.palette.common.white,
    },
}));

const DrawerAppBar = () => {

    i18n.use();
    const [open, setOpen] = React.useState(false);
    const [checked, setChecked] = React.useState(true);
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const switchChecked = event.target.checked;
        if(switchChecked){
            i18n.locale("en").then(()=>{});
        }else {
            i18n.locale("zh_CN").then(()=>{});
        }
        setChecked(event.target.checked);
    };
    return <React.Fragment>
        <AppBar position={"sticky"}>
        <Toolbar>
            <IconButton
                color="inherit"
                aria-label="open drawer"
                onClick={handleOpen}
                edge="start"
            >
                <MenuIcon/>
            </IconButton>
            <Typography component="div">
                <Grid component="label" container spacing={1} sx={{alignItems: 'center'}}>
                    <Grid>中文</Grid>
                    <Grid>
                        <AntSwitch checked={checked} onChange={handleChange} name="locale-switch" />
                    </Grid>
                    <Grid>English</Grid>
                </Grid>
            </Typography>
        </Toolbar>
    </AppBar>
        <MUIDrawer open={open} anchor={"left"} onClose={handleClose}>
            <List>
                <ListItem><Button><Link to={'/'}>{i18n.chain.drawer.lobby}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/cards'}>{i18n.chain.drawer.cards}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/local4p'}>{i18n.chain.drawer.fourPlayer}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/about'}>{i18n.chain.drawer.about}</Link></Button></ListItem>
                <ListItem><Button><Link to={'/songJinn'}>{"宋金战争"}</Link></Button></ListItem>
            </List>
        </MUIDrawer>
    </React.Fragment>
}

export default DrawerAppBar;

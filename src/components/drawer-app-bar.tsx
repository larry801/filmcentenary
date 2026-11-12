import {Link, useLocation} from 'react-router-dom'
import React from "react";
import Drawer from "@mui/material/Drawer";
import MenuIcon from '@mui/icons-material/Menu';
import i18n from "../constant/i18n";
import AppBar from '@mui/material/AppBar';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Divider from '@mui/material/Divider';
import Box from '@mui/material/Box';
import Switch from "@mui/material/Switch"
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

interface DrawerNavItem {
    to: string;
    label: string;
}

interface DrawerNavGroup {
    key: string;
    title: string;
    items: DrawerNavItem[];
}

const DrawerAppBar = () => {

    i18n.use();
    const {pathname} = useLocation();
    const isVQ = /^\/(localVQ(?:\/|$)|join\/virginQueen\/)/.test(pathname);
    const isIE = /^\/(localIE(?:\/|$)|imperialElegy(?:\/|$)|join\/imperialElegy\/)/.test(pathname);
    const [open, setOpen] = React.useState(false);
    // Derive the switch position from the active locale: the app starts in
    // zh_CN, so a hard-coded `true` made the first click a no-op.
    const checked = i18n.getLocaleName() === "en";
    const handleOpen = () => setOpen(true);
    const handleClose = () => setOpen(false);
    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if(event.target.checked){
            i18n.locale("en").then(()=>{});
        }else {
            i18n.locale("zh_CN").then(()=>{});
        }
    };
    const drawer = i18n.chain.drawer;
    const navGroups: DrawerNavGroup[] = [
        {
            key: 'general',
            title: drawer.section.general,
            items: [
                {to: '/cards', label: drawer.cards},
                {to: '/about', label: drawer.about},
                {to: '/lobby', label: drawer.globalLobby},
            ],
        },
        {
            key: 'film',
            title: drawer.section.film,
            items: [
                {to: '/', label: drawer.film.multiplayer},
                {to: '/local2p', label: drawer.film.local2p},
                {to: '/local3p', label: drawer.film.local3p},
                {to: '/local4p', label: drawer.film.local4p},
            ],
        },
        {
            key: 'songJinn',
            title: drawer.section.songJinn,
            items: [
                {to: '/songJinn', label: drawer.songJinn.multiplayer},
                {to: '/local', label: drawer.songJinn.local},
            ],
        },
        {
            key: 'imperialElegy',
            title: drawer.section.imperialElegy,
            items: [
                {to: '/imperialElegy', label: drawer.imperialElegy.multiplayer},
                {to: '/localIE', label: drawer.imperialElegy.local},
            ],
        },
        {
            key: 'virginQueen',
            title: drawer.section.virginQueen,
            items: [
                {to: '/virginQueen', label: drawer.virginQueen.multiplayer},
                {to: '/localVQ', label: drawer.virginQueen.local},
                {to: '/localVQ/tutorial', label: drawer.virginQueen.tutorial},
            ],
        },
    ];
    return <React.Fragment>
        <AppBar position={"sticky"} sx={isIE ? {height: 48, bgcolor: "#211b16", color: "#ead7af", boxShadow: "none", borderBottom: "1px solid #80633a"} : isVQ ? {height: 48, bgcolor: "#211b16", color: "#ead7af", boxShadow: "none", borderBottom: "1px solid #80633a"} : undefined}>
        <Toolbar sx={isVQ || isIE ? {minHeight: "47px !important", gap: 1} : undefined}>
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
            {isVQ && <Typography sx={{ml: "auto", fontSize: 11, letterSpacing: ".15em", fontFamily: "Georgia, serif"}}>VIRGIN QUEEN</Typography>}
            {isIE && <Typography sx={{ml: "auto", fontSize: 11, letterSpacing: ".15em", fontFamily: "Georgia, serif"}}>IMPERIAL ELEGY</Typography>}
        </Toolbar>
    </AppBar>
        <MUIDrawer open={open} anchor={"left"} onClose={handleClose}>
            <Box
                component="nav"
                aria-label={drawer.navigation}
                sx={{width: 280, bgcolor: "background.paper", pb: 1}}
            >
                {navGroups.map((group, index) => (
                    <React.Fragment key={group.key}>
                        {index > 0 && <Divider/>}
                        <List
                            dense
                            subheader={
                                <ListSubheader
                                    component="div"
                                    disableSticky
                                    sx={{
                                        bgcolor: "background.paper",
                                        color: "text.primary",
                                        fontWeight: 700,
                                        fontSize: "0.78rem",
                                        letterSpacing: ".08em",
                                        textTransform: "uppercase",
                                        pt: 1.5,
                                    }}
                                >
                                    {group.title}
                                </ListSubheader>
                            }
                        >
                            {group.items.map(item => (
                                <ListItem key={item.to} disablePadding>
                                    <ListItemButton
                                        component={Link}
                                        to={item.to}
                                        selected={pathname === item.to}
                                        onClick={handleClose}
                                        sx={{mx: 1, borderRadius: 1}}
                                    >
                                        <ListItemText primary={item.label}/>
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    </React.Fragment>
                ))}
            </Box>
        </MUIDrawer>
    </React.Fragment>
}

export default DrawerAppBar;

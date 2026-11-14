import React from "react";
import {Link} from "react-router-dom";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import i18n from "../constant/i18n";
import {getNavGroups} from "../constant/navigation";

/**
 * Landing page: the game/mode navigation that used to live only in the drawer
 * is now the home page itself. The film lobby is a separate page at /film.
 */
const HomePage = () => {
    i18n.use();
    const groups = getNavGroups();
    return (
        <Container maxWidth="lg" sx={{py: {xs: 2, sm: 4}}}>
            <Box sx={{mb: 3}}>
                <Typography variant="h4" component="h1" gutterBottom>
                    {i18n.chain.home.title}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    {i18n.chain.home.subtitle}
                </Typography>
            </Box>
            <Grid container spacing={3}>
                {groups.map((group) => (
                    <Grid key={group.key} size={{xs: 12, sm: 6, md: 4}}>
                        <Paper elevation={2} role="group" aria-label={group.title} sx={{p: 2, height: "100%"}}>
                            <Typography variant="h6" component="h2" gutterBottom>
                                {group.title}
                            </Typography>
                            <Box sx={{display: "flex", flexDirection: "column", gap: 1}}>
                                {group.items.map((item) => (
                                    <Button
                                        key={item.to}
                                        component={Link}
                                        to={item.to}
                                        variant="outlined"
                                        size="small"
                                        sx={{justifyContent: "flex-start", textAlign: "left"}}
                                    >
                                        {item.label}
                                    </Button>
                                ))}
                            </Box>
                        </Paper>
                    </Grid>
                ))}
            </Grid>
        </Container>
    );
};

export default HomePage;

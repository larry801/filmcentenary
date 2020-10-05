import {AppBar, Tab, Tabs} from "@material-ui/core";
import React from "react";

export const TabPanel = ()=>{
    const [tab,setTab] = React.useState(0);
    const handleChange = (event: React.ChangeEvent<{}>, newValue: number) => {
        setTab(newValue);
    };
    return <AppBar position={"sticky"}>
        <Tabs value={tab}>
            <Tab label={"A"}/>
            <Tab label={"B"}/>
        </Tabs>
    </AppBar>
}

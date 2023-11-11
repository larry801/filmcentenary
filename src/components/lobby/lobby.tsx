import {
    Redirect,
    Route,
    BrowserRouter as Router,
    Switch,
} from "react-router-dom";
import React from "react";

const App = () => (
    <Router>
        <Switch>
            <Route exact path="/join/:matchID/:player">
            </Route>
            <Route exact path="/">
            </Route>
            <Route path="*">
                <Redirect to="/" />
            </Route>
        </Switch>
    </Router>
);

export default App;

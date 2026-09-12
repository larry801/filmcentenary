import {
    Navigate,
    Route,
    BrowserRouter as Router,
    Routes,
} from "react-router-dom";
import React from "react";

const App = () => (
    <Router>
        <Routes>
            <Route path="/join/:matchID/:player"/>
            <Route path="/"/>
            <Route path="*" element={<Navigate replace to="/"/>}/>
        </Routes>
    </Router>
);

export default App;
